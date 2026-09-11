// All entitlement writes and their deduplication record commit in one D1 batch.
export const MAX_PAYMENT_DOLLARS = 999999;
export const TOTAL_SQUARES = 1_000_000;

export function validatePaymentAmount(cents) {
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > MAX_PAYMENT_DOLLARS * 100) {
    throw new Error('Payment amount is invalid.');
  }
  return cents;
}

export async function reserveListing(db, listing) {
  const reservationKey = crypto.randomUUID();
  // Allocation and insertion are one statement: another checkout cannot reuse this ID.
  const row = await db.prepare(`
    WITH RECURSIVE candidate(square_id) AS (
      SELECT 0 UNION ALL
      SELECT square_id + 1 FROM candidate WHERE square_id < ${TOTAL_SQUARES - 1}
    )
    INSERT INTO squares (square_id, label, description, url, owner_host, category,
      owner_email, verified_company, territory_key, territory_size, logo_url, status, created_at)
    SELECT candidate.square_id, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, 'pending', ?
    FROM candidate LEFT JOIN squares ON squares.square_id = candidate.square_id
    WHERE squares.square_id IS NULL LIMIT 1
    RETURNING square_id
  `).bind(listing.label, listing.description || null, listing.url, listing.ownerHost,
    listing.category, listing.email || null, reservationKey, listing.logoUrl || null,
    new Date().toISOString()).first();
  if (!row) throw new Error('The listing directory is full.');
  return { squareId: Number(row.square_id), reservationKey };
}

export async function releaseReservation(db, squareId, reservationKey) {
  // An old request must never clean up a later reservation that reused its ID.
  await db.prepare("DELETE FROM squares WHERE square_id = ? AND territory_key = ? AND status = 'pending'")
    .bind(squareId, reservationKey).run();
}

export async function fulfillListingPayment(db, payment) {
  const { id, squareIds, expectedUrl, reservationKey: suppliedReservationKey = null, paymentIntentId = null,
    location = null, logoUrl = null, recurring = false } = payment;
  const amountCents = validatePaymentAmount(payment.amountCents);
  const days = payment.featuredDays;
  if (!id || !expectedUrl || !Array.isArray(squareIds) || !squareIds.length ||
      squareIds.some(value => !Number.isInteger(value) || value < 0 || value >= TOTAL_SQUARES) ||
      new Set(squareIds).size !== squareIds.length || !Number.isInteger(days) || days < 1 || days > MAX_PAYMENT_DOLLARS) {
    throw new Error('Listing payment metadata is invalid.');
  }
  const primaryId = squareIds[0];
  const placeholders = squareIds.map(() => '?').join(',');
  const { results: listings } = await db.prepare(`SELECT square_id, url, territory_key, status FROM squares WHERE square_id IN (${placeholders})`)
    .bind(...squareIds).all();
  if (listings.length !== squareIds.length || listings.some(row => row.url !== expectedUrl ||
      (suppliedReservationKey && row.territory_key !== suppliedReservationKey) ||
      (recurring && row.status !== 'paid'))) {
    throw new Error('Payment does not match its listing reservation.');
  }
  const reservationKey = suppliedReservationKey || listings[0].territory_key;
  const now = new Date().toISOString();
  const unseen = 'NOT EXISTS (SELECT 1 FROM featured_payments WHERE checkout_session_id = ?)';
  const statements = [];
  for (const squareId of squareIds) {
    const storedSession = squareIds.length > 1 ? `${id}:${squareId}` : id;
    statements.push(db.prepare(`UPDATE squares SET
        checkout_session_id = CASE WHEN status = 'pending' THEN ? ELSE checkout_session_id END,
        payment_intent_id = CASE WHEN status = 'pending' THEN ? ELSE payment_intent_id END,
        logo_url = CASE WHEN status = 'pending' THEN COALESCE(?, logo_url) ELSE logo_url END,
        purchase_city = CASE WHEN status = 'pending' THEN COALESCE(?, purchase_city) ELSE purchase_city END,
        purchase_country = CASE WHEN status = 'pending' THEN COALESCE(?, purchase_country) ELSE purchase_country END,
        purchase_latitude = CASE WHEN status = 'pending' THEN COALESCE(?, purchase_latitude) ELSE purchase_latitude END,
        purchase_longitude = CASE WHEN status = 'pending' THEN COALESCE(?, purchase_longitude) ELSE purchase_longitude END,
        location_source = CASE WHEN status = 'pending' THEN COALESCE(?, location_source) ELSE location_source END,
        paid_at = COALESCE(paid_at, ?), status = 'paid'
      WHERE square_id = ? AND url = ? AND (? IS NULL OR territory_key = ?) AND ${unseen}`)
      .bind(storedSession, paymentIntentId, logoUrl, location?.city ?? null, location?.country ?? null,
        location?.latitude ?? null, location?.longitude ?? null, location?.source ?? null,
        now, squareId, expectedUrl, reservationKey, reservationKey, id));
  }
  statements.push(db.prepare(`UPDATE squares SET featured_from = ?,
      featured_until = strftime('%Y-%m-%dT%H:%M:%fZ', max(unixepoch(?), COALESCE(unixepoch(featured_until), 0)), 'unixepoch', '+' || ? || ' days'),
      featured_amount_cents = COALESCE(featured_amount_cents, 0) + ?
    WHERE square_id = ? AND status = 'paid' AND url = ?
      AND (? IS NULL OR territory_key = ?) AND ${unseen}`)
    .bind(now, now, days, amountCents, primaryId, expectedUrl, reservationKey, reservationKey, id));
  // Insert last so every preceding write sees the same guard; batch rollback covers failures.
  statements.push(db.prepare(`INSERT INTO featured_payments (checkout_session_id, square_id, amount_cents, total_bid_cents, created_at)
    SELECT ?, square_id, ?, featured_amount_cents, ? FROM squares
    WHERE square_id = ? AND status = 'paid' AND url = ?
      AND (? IS NULL OR territory_key = ?) AND ${unseen}`)
    .bind(id, amountCents, now, primaryId, expectedUrl, reservationKey, reservationKey, id));
  const results = await db.batch(statements);
  if (!Number(results.at(-1).meta.changes)) {
    const recorded = await db.prepare('SELECT square_id FROM featured_payments WHERE checkout_session_id = ?').bind(id).first();
    if (!recorded || Number(recorded.square_id) !== primaryId) throw new Error('Payment reservation is no longer available.');
  }
}

export async function fulfillSponsorship(db, payment) {
  const { id, category, url, label } = payment;
  const amountCents = validatePaymentAmount(payment.amountCents);
  if (!id || !category || !url || !label) throw new Error('Sponsorship payment metadata is invalid.');
  const now = new Date().toISOString();
  const unseen = 'NOT EXISTS (SELECT 1 FROM category_sponsor_payments WHERE checkout_session_id = ?)';
  await db.batch([
    db.prepare(`INSERT INTO category_sponsorships (category, url, label, amount_cents, active_until, created_at, updated_at)
      SELECT ?, ?, ?, ?, datetime(?, '+30 days'), ?, ? WHERE ${unseen}
      ON CONFLICT(category, url) DO UPDATE SET
        amount_cents = category_sponsorships.amount_cents + excluded.amount_cents,
        active_until = datetime(max(unixepoch(?), COALESCE(unixepoch(category_sponsorships.active_until), 0)), 'unixepoch', '+30 days'),
        updated_at = excluded.updated_at`)
      .bind(category, url, label, amountCents, now, now, now, id, now),
    db.prepare(`INSERT INTO category_sponsor_payments (checkout_session_id, category, url, amount_cents, total_bid_cents, created_at)
      SELECT ?, category, url, ?, amount_cents, ? FROM category_sponsorships
      WHERE category = ? AND url = ? AND ${unseen}`)
      .bind(id, amountCents, now, category, url, id),
  ]);
}
