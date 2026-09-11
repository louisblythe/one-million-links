import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { Miniflare } from 'miniflare';
import * as payments from '../worker/payments.js';

let runtime, db, env, worker, stripe;
before(async () => {
  runtime = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("test"); } }',
    compatibilityDate: '2026-05-27', d1Databases: { DB: 'payments-test' } });
  db = await runtime.getD1Database('DB');
  for (const name of readdirSync('migrations').sort()) {
    if (!name.endsWith('.sql') || name.includes('seed')) continue;
    const statements = readFileSync(`migrations/${name}`, 'utf8').split(';').map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
  env = { DB: db, STRIPE_SECRET_KEY: 'test_only', STRIPE_WEBHOOK_SECRET: 'webhook_test_only', APP_URL: 'http://localhost' };
  // Load the actual request helpers without Node trying to initialise Worker-only image/WASM imports.
  const source = readFileSync('worker/index.js', 'utf8');
  worker = vm.createContext({ ...payments, crypto, Request, Response, URL, URLSearchParams,
    TextEncoder, Uint8Array, AbortSignal, console, fetch: (...args) => stripe(...args) });
  vm.runInContext(source.slice(source.indexOf('const TOTAL_SQUARES'), source.indexOf('export default')) +
    source.slice(source.indexOf('async function recordPresence')), worker);
});
after(async () => runtime?.dispose());
beforeEach(async () => {
  await db.batch(['featured_payments', 'category_sponsor_payments', 'category_sponsorships', 'squares']
    .map(table => db.prepare(`DELETE FROM ${table}`)));
  stripe = async () => Response.json({error:{message:'Stripe rejected checkout'}}, {status:400});
});

async function reserve(url = 'https://owner.example/') {
  return { ...await payments.reserveListing(db, {label:'Owner', url, ownerHost:new URL(url).hostname,
    category:'Developer Tools', logoUrl:'https://owner.example/logo.png'}), url };
}
function payment(reservation, overrides = {}) {
  return {id:crypto.randomUUID(), squareIds:[reservation.squareId], reservationKey:reservation.reservationKey,
    expectedUrl:reservation.url, amountCents:1000, featuredDays:10, ...overrides};
}
async function listing(id = 0) { return db.prepare('SELECT * FROM squares WHERE square_id = ?').bind(id).first(); }
async function ledger() { return db.prepare('SELECT * FROM featured_payments ORDER BY created_at').all(); }
function request(values) {
  return new Request('http://localhost/checkout', {method:'POST', body:new URLSearchParams({
    label:'Untrusted replacement', url:'https://owner.example/', category:'Other', payment_level:'1', ...values })});
}
function session(reservation, overrides = {}) {
  return {id:crypto.randomUUID(), payment_status:'paid', amount_total:1000, metadata:{
    square_ids:String(reservation.squareId), reservation_key:reservation.reservationKey,
    url:reservation.url, featured_days:'10', total_bid_cents:'1000',
  }, ...overrides};
}

test('concurrent reservations allocate distinct IDs and preserve each buyer', async () => {
  const reservations = await Promise.all(Array.from({length:20}, (_, i) => reserve(`https://buyer-${i}.example/`)));
  assert.equal(new Set(reservations.map(r => r.squareId)).size, 20);
  await Promise.all(reservations.map(r => payments.fulfillListingPayment(db, payment(r))));
  for (const r of reservations) assert.equal((await listing(r.squareId)).url, r.url);
});

test('failed checkout cannot edit another paid listing', async () => {
  const r = await reserve();
  await payments.fulfillListingPayment(db, payment(r));
  const original = await listing();
  await assert.rejects(worker.createCheckout(request(), env), /Stripe rejected/);
  assert.deepEqual(await listing(), original);
});

test('successful public rebid credits rank without modifying listing identity or assets', async () => {
  const r = await reserve();
  await payments.fulfillListingPayment(db, payment(r));
  const original = await listing();
  let created;
  stripe = async (_, options) => {
    created = options.body;
    return Response.json({url:'https://checkout.stripe.com/test', id:'rebid'});
  };
  assert.equal((await worker.createCheckout(request({logo_url:'https://other.example/logo.png'}), env)).status, 303);
  const metadata = Object.fromEntries([...created].filter(([key]) => key.startsWith('metadata[')).map(([key,value]) => [key.slice(9,-1), value]));
  await worker.fulfillCheckoutSession(env, {id:'rebid', amount_total:100, metadata});
  const updated = await listing();
  for (const field of ['category','label','url','logo_url','purchase_country','checkout_session_id']) assert.equal(updated[field], original[field]);
  assert.equal(updated.featured_amount_cents, 1100);
});

test('cleanup and fulfilment require the correct reservation when an ID is reused', async () => {
  const old = await reserve();
  await payments.releaseReservation(db, old.squareId, old.reservationKey);
  const next = await reserve();
  assert.equal(next.squareId, old.squareId);
  await payments.releaseReservation(db, old.squareId, old.reservationKey);
  assert.equal((await listing()).territory_key, next.reservationKey);
  await assert.rejects(payments.fulfillListingPayment(db, payment(old)), /reservation/);
  assert.equal((await listing()).status, 'pending');
});

test('definitive Stripe rejection releases only the new reservation', async () => {
  await assert.rejects(worker.createCheckout(request(), env), /Stripe rejected/);
  assert.equal(await listing(), null);
});

test('ambiguous Stripe transport failure retains its reservation', async () => {
  stripe = async () => { throw Error('Connection lost after request'); };
  await assert.rejects(worker.createCheckout(request(), env), /Connection lost/);
  assert.equal((await listing()).status, 'pending');
});

test('rank-update failure rolls back publication and can be retried exactly once', async () => {
  const r = await reserve(); const p = payment(r);
  await db.prepare("CREATE TRIGGER reject_rank BEFORE UPDATE OF featured_amount_cents ON squares BEGIN SELECT RAISE(ABORT, 'injected rank failure'); END").run();
  await assert.rejects(payments.fulfillListingPayment(db, p), /injected rank failure/);
  assert.equal((await listing()).status, 'pending');
  assert.equal((await ledger()).results.length, 0);
  await db.prepare('DROP TRIGGER reject_rank').run();
  await payments.fulfillListingPayment(db, p);
  const complete = await listing();
  await payments.fulfillListingPayment(db, p);
  assert.deepEqual(await listing(), complete);
  assert.equal(complete.featured_amount_cents, 1000);
});

test('ledger-write failure rolls back the preceding rank update', async () => {
  const r = await reserve(); const p = payment(r);
  await db.prepare("CREATE TRIGGER reject_ledger BEFORE INSERT ON featured_payments BEGIN SELECT RAISE(ABORT, 'injected ledger failure'); END").run();
  await assert.rejects(payments.fulfillListingPayment(db, p), /injected ledger failure/);
  assert.equal((await listing()).featured_amount_cents, null);
  await db.prepare('DROP TRIGGER reject_ledger').run();
  await payments.fulfillListingPayment(db, p);
  assert.equal((await listing()).featured_amount_cents, 1000);
});

test('concurrent stale rebids credit every paid dollar and duplicate deliveries do not extend time', async () => {
  const r = await reserve(); await payments.fulfillListingPayment(db, payment(r));
  const a = session(r, {id:'tab_a', amount_total:500});
  const b = session(r, {id:'tab_b', amount_total:500});
  a.metadata = {...a.metadata, total_bid_cents:'1500', featured_days:'5'};
  b.metadata = {...b.metadata, total_bid_cents:'1500', featured_days:'5'};
  await Promise.all([worker.fulfillCheckoutSession(env,b),worker.fulfillCheckoutSession(env,a)]);
  const completed = await listing();
  await Promise.all([worker.fulfillCheckoutSession(env,a),worker.fulfillCheckoutSession(env,b)]);
  assert.deepEqual(await listing(), completed);
  assert.equal(completed.featured_amount_cents, 2000);
  assert.equal((await ledger()).results.reduce((sum,p) => sum + p.amount_cents,0), 2000);
});

for (const amount of [1, 10000, 10001, payments.MAX_PAYMENT_DOLLARS]) {
  test(`accepted $${amount} payment receives complete rank, duration, and ledger credit`, async () => {
    const r = await reserve();
    assert.equal(worker.normalizePaymentLevel(amount,1), amount);
    const paidSession = session(r, {amount_total:amount*100});
    paidSession.metadata.featured_days=String(amount);
    await worker.fulfillCheckoutSession(env,paidSession);
    const row = await listing();
    assert.equal(row.featured_amount_cents,amount*100);
    assert.ok(Math.abs((Date.parse(row.featured_until)-Date.parse(row.featured_from))/86400000 - amount) < 0.001);
    assert.equal((await ledger()).results[0].amount_cents,amount*100);
  });
}

test('unsupported amounts and malformed durations fail before checkout or publication', async () => {
  for (const amount of ['1000000','0','1.5']) await assert.rejects(worker.createCheckout(request({payment_level:amount}),env), /whole-dollar/);
  assert.equal(await listing(),null);
  const r = await reserve(); const paid = session(r); paid.metadata.featured_days='1000000';
  await assert.rejects(worker.fulfillCheckoutSession(env,paid), /duration/);
  assert.equal((await listing()).status,'pending');
});

test('monthly checkout and renewals use actual charged amounts, with retry-safe credit', async () => {
  const r = await reserve(); const initial = session(r,{amount_total:500}); initial.metadata.featured_days='30';
  await worker.fulfillCheckoutSession(env,initial);
  const invoice = {id:'renewal', amount_paid:500, parent:{subscription_details:{metadata:{promotion_type:'monthly',square_id:String(r.squareId),url:r.url,monthly_amount_cents:'500'}}}};
  await worker.applyRecurringInvoice(env,invoice);
  const paid = await listing();
  await worker.applyRecurringInvoice(env,invoice);
  assert.deepEqual(await listing(),paid);
  assert.equal(paid.featured_amount_cents,1000);
  assert.deepEqual((await ledger()).results.map(p=>p.amount_cents),[500,500]);
});

test('sponsor failures roll back and overlapping bids accumulate once', async () => {
  const p = {id:'sponsor_initial',category:'Developer Tools',url:'https://owner.example/',label:'Owner',amountCents:1000};
  await db.prepare("CREATE TRIGGER reject_sponsor BEFORE INSERT ON category_sponsor_payments BEGIN SELECT RAISE(ABORT, 'injected sponsor failure'); END").run();
  await assert.rejects(payments.fulfillSponsorship(db,p),/injected sponsor failure/);
  assert.equal(await db.prepare('SELECT * FROM category_sponsorships').first(),null);
  await db.prepare('DROP TRIGGER reject_sponsor').run();
  await payments.fulfillSponsorship(db,p);
  const a={...p,id:'a',amountCents:100}, b={...p,id:'b',amountCents:100};
  await Promise.all([payments.fulfillSponsorship(db,a),payments.fulfillSponsorship(db,b)]);
  const paid = await db.prepare('SELECT * FROM category_sponsorships').first();
  await Promise.all([payments.fulfillSponsorship(db,a),payments.fulfillSponsorship(db,b)]);
  assert.deepEqual(await db.prepare('SELECT * FROM category_sponsorships').first(),paid);
  assert.equal(paid.amount_cents,1200);
});

test('legacy categories resolve to their current canonical collection', () => {
  assert.equal(worker.categoryFromPath('agency'),'Agencies, Studios & Services');
  assert.equal(worker.categoryFromPath('Agency'),'Agencies, Studios & Services');
  assert.equal(worker.categoryFromPath('local-business'),'Travel, Local & Lifestyle');
  assert.equal(worker.categoryFromPath('not-a-category'),null);
});

for (const eventType of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
  test(`${eventType} requires a valid signature and fulfils only once`, async () => {
    const r = await reserve();
    const event = {type:eventType, data:{object:session(r)}};
    const payload = JSON.stringify(event);
    const timestamp = Math.floor(Date.now()/1000);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw',encoder.encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${payload}`))).toString('hex');
    const webhook = sig => new Request('http://localhost/stripe/webhook',{method:'POST',body:payload,headers:{'stripe-signature':sig}});
    assert.equal((await worker.stripeWebhook(webhook(`t=${timestamp},v1=invalid`),env)).status,400);
    assert.equal((await listing()).status,'pending');
    assert.equal((await worker.stripeWebhook(webhook(`t=${timestamp},v1=${signature}`),env)).status,200);
    const paid = await listing();
    await worker.stripeWebhook(webhook(`t=${timestamp},v1=${signature}`),env);
    assert.deepEqual(await listing(),paid);
    assert.equal(paid.featured_amount_cents,1000);
  });
}

test('recurring invoice failures roll back and recover on delivery retry', async () => {
  const r=await reserve(); await payments.fulfillListingPayment(db,payment(r));
  const invoice={id:'retry_invoice',amount_paid:500,parent:{subscription_details:{metadata:{promotion_type:'monthly',square_id:String(r.squareId),url:r.url}}}};
  const original=await listing();
  await db.prepare("CREATE TRIGGER reject_invoice BEFORE INSERT ON featured_payments BEGIN SELECT RAISE(ABORT, 'injected invoice failure'); END").run();
  await assert.rejects(worker.applyRecurringInvoice(env,invoice),/injected invoice failure/);
  assert.deepEqual(await listing(),original);
  await db.prepare('DROP TRIGGER reject_invoice').run();
  await worker.applyRecurringInvoice(env,invoice);
  assert.equal((await listing()).featured_amount_cents,1500);
});
