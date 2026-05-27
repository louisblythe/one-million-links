const TOTAL_SQUARES = 1_000_000;
const STRIPE_API_VERSION = "2026-02-25.clover";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (isRead(request) && url.pathname === "/") {
        return html(homePage(await paidSquares(env), Number(url.searchParams.get("square") || "1")));
      }

      if (isRead(request) && url.pathname === "/api/squares") {
        return json({ squares: await paidSquares(env) });
      }

      if (request.method === "POST" && url.pathname === "/checkout") {
        return await createCheckout(request, env);
      }

      if (isRead(request) && url.pathname === "/success") {
        return await checkoutSuccess(url, env);
      }

      if (request.method === "POST" && url.pathname === "/stripe/webhook") {
        return await stripeWebhook(request, env);
      }

      if (isRead(request) && url.pathname === "/assets/app.css") {
        return new Response(css(), { headers: { "content-type": "text/css; charset=utf-8" } });
      }

      if (isRead(request) && url.pathname === "/assets/app.js") {
        return new Response(clientJs(), { headers: { "content-type": "application/javascript; charset=utf-8" } });
      }

      if (isRead(request) && url.pathname === "/favicon.svg") {
        return new Response(favicon(), { headers: { "content-type": "image/svg+xml" } });
      }

      return html(messagePage("Page not found."), 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";

      if (url.pathname === "/api/squares" || url.pathname === "/stripe/webhook") {
        return json({ error: message }, 400);
      }

      return html(messagePage(message), 400);
    }
  },
};

function isRead(request) {
  return request.method === "GET" || request.method === "HEAD";
}

async function paidSquares(env) {
  const { results } = await env.DB.prepare(
    "SELECT square_id, label, url FROM squares WHERE status = 'paid' ORDER BY square_id ASC",
  ).all();

  return results || [];
}

async function createCheckout(request, env) {
  assertStripeSecret(env);

  const form = await request.formData();
  const squareId = validateSquareId(Number(form.get("square_id") || 1) - 1);
  const label = normalizeLabel(String(form.get("label") || ""));
  const linkUrl = normalizeUrl(String(form.get("url") || ""));
  const email = normalizeEmail(String(form.get("email") || ""));

  await reserveSquare(env, squareId, label, linkUrl, email);

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("client_reference_id", String(squareId));
  body.set("success_url", `${appUrl(env)}/success?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${appUrl(env)}/?square=${squareId + 1}&cancelled=1`);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", String(env.APP_CURRENCY || "usd").toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", "100");
  body.set("line_items[0][price_data][product]", env.STRIPE_PRODUCT_ID || "prod_Uam47pbENlHbmX");
  body.set("metadata[square_id]", String(squareId));
  body.set("metadata[label]", label);
  body.set("metadata[url]", linkUrl);

  if (email) {
    body.set("customer_email", email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
    },
    body,
  });

  const session = await response.json();

  if (!response.ok || !session.url) {
    throw new Error(session.error?.message || "Stripe checkout session could not be created.");
  }

  return Response.redirect(session.url, 303);
}

async function checkoutSuccess(url, env) {
  assertStripeSecret(env);

  const sessionId = url.searchParams.get("session_id");

  if (sessionId) {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "stripe-version": STRIPE_API_VERSION,
      },
    });
    const session = await response.json();

    if (response.ok && session.payment_status === "paid") {
      await markSquarePaid(env, Number(session.client_reference_id), session.id, session.payment_intent || null);
    }
  }

  return html(successPage());
}

async function stripeWebhook(request, env) {
  assertStripeSecret(env);

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Set STRIPE_WEBHOOK_SECRET before accepting webhooks.");
  }

  const signature = request.headers.get("stripe-signature") || "";
  const payload = await request.text();

  if (!(await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid Stripe signature." }, 400);
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed" && event.data?.object?.payment_status === "paid") {
    const session = event.data.object;
    await markSquarePaid(env, Number(session.client_reference_id), session.id, session.payment_intent || null);
  }

  return json({ received: true });
}

async function reserveSquare(env, squareId, label, url, email) {
  const existing = await env.DB.prepare("SELECT status FROM squares WHERE square_id = ?").bind(squareId).first();

  if (existing?.status === "paid") {
    throw new Error("That square has already been claimed.");
  }

  await env.DB.prepare(
    `INSERT INTO squares (square_id, label, url, owner_email, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
      ON CONFLICT(square_id) DO UPDATE SET
        label = excluded.label,
        url = excluded.url,
        owner_email = excluded.owner_email,
        status = 'pending',
        created_at = excluded.created_at`,
  ).bind(squareId, label, url, email, new Date().toISOString()).run();
}

async function markSquarePaid(env, squareId, checkoutSessionId, paymentIntentId) {
  await env.DB.prepare(
    `UPDATE squares
      SET status = 'paid',
          checkout_session_id = ?,
          payment_intent_id = ?,
          paid_at = COALESCE(paid_at, ?)
      WHERE square_id = ?`,
  ).bind(checkoutSessionId, paymentIntentId, new Date().toISOString(), validateSquareId(squareId)).run();
}

function validateSquareId(squareId) {
  if (!Number.isInteger(squareId) || squareId < 0 || squareId >= TOTAL_SQUARES) {
    throw new Error("Choose a square between 1 and 1,000,000.");
  }

  return squareId;
}

function normalizeLabel(label) {
  const value = label.trim().slice(0, 80);

  if (!value) {
    throw new Error("Enter a label for the link.");
  }

  return value;
}

function normalizeUrl(url) {
  const value = url.trim();
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol.");
    }

    return parsed.toString();
  } catch {
    throw new Error("Enter a valid URL.");
  }
}

function normalizeEmail(email) {
  const value = email.trim();

  if (!value) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Enter a valid email receipt address.");
  }

  return value;
}

function assertStripeSecret(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Set STRIPE_SECRET_KEY before creating a checkout session.");
  }
}

function appUrl(env) {
  return String(env.APP_URL || "https://linkforadollar.com").replace(/\/+$/, "");
}

async function verifyStripeSignature(payload, signature, secret) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    }),
  );

  if (!parts.t || !parts.v1) {
    return false;
  }

  const data = new TextEncoder().encode(`${parts.t}.${payload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, data);
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(expected, parts.v1);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function json(body, status = 200) {
  return Response.json(body, { status });
}

function homePage(paidSquares, selectedSquare) {
  const safeSelected = Math.max(1, Math.min(TOTAL_SQUARES, selectedSquare || 1));
  const squaresJson = JSON.stringify(paidSquares).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Link for a Dollar</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/app.css">
  </head>
  <body>
    <main class="page-shell">
      <section class="masthead">
        <div class="hero-copy">
          <p class="hero-kicker">Own a pixel of the internet</p>
          <h1>Link for a Dollar</h1>
          <p class="hero-subhead">1,000,000 permanent homepage spots. Claim yours before they're gone.</p>
        </div>
        <div class="stats">
          <strong id="claimedCount">${paidSquares.length}</strong>
          <span>claimed</span>
        </div>
      </section>

      <section class="workspace" aria-label="One million link squares">
        <div class="canvas-panel">
          <canvas id="grid" width="1000" height="1000" aria-label="One million selectable squares"></canvas>
        </div>

        <aside class="claim-panel">
          <div class="claim-copy">
            <p class="eyebrow">Permanent backlink</p>
            <h2>Own permanent homepage real estate</h2>
            <ul class="claim-benefits">
              <li>Add your brand to the wall</li>
              <li>Get indexed forever</li>
              <li>Secure your square before it's gone</li>
            </ul>
          </div>

          <form action="/checkout" method="post">
            <div class="field-row">
              <label for="square_id">Homepage spot</label>
              <input id="square_id" name="square_id" type="number" min="1" max="1000000" value="${safeSelected}" required>
            </div>
            <div class="field-row">
              <label for="label">Brand on the wall</label>
              <input id="label" name="label" maxlength="80" placeholder="Your brand" required>
            </div>
            <div class="field-row">
              <label for="url">Backlink destination</label>
              <input id="url" name="url" type="url" placeholder="https://example.com" required>
            </div>
            <div class="field-row">
              <label for="email">Ownership receipt</label>
              <input id="email" name="email" type="email" placeholder="you@example.com">
            </div>
            <button type="submit">Claim your spot on the internet</button>
          </form>

          <div class="selection">
            <span>Selected</span>
            <strong id="selectedLabel">#${safeSelected}</strong>
            <a id="selectedLink" href="#" target="_blank" rel="noopener">Open claimed link</a>
          </div>
        </aside>
      </section>

      <footer class="seo-footer" aria-labelledby="seo-footer-title">
        <div class="footer-about">
          <p class="eyebrow">About</p>
          <h2 id="seo-footer-title">Why SEOs buy a square</h2>
          <p>
            One dollar buys a permanent, crawlable link on a public million-square page built for early adopters who want their site visible.
          </p>
        </div>
        <ul class="value-props" aria-label="SEO value props">
          <li>
            <span>Permanent dofollow backlink</span>
            <button class="info-tip" type="button" aria-label="Permanent dofollow backlink information" title="Paid squares link directly to your URL without a nofollow attribute.">i</button>
          </li>
          <li>
            <span>Indexed public page</span>
            <button class="info-tip" type="button" aria-label="Indexed public page information" title="Your claimed square appears on a public, crawlable page.">i</button>
          </li>
          <li>
            <span>Crawlable brand label</span>
            <button class="info-tip" type="button" aria-label="Crawlable brand label information" title="Your label is rendered in the public page data next to your destination URL.">i</button>
          </li>
          <li>
            <span>Early adopter placement</span>
            <button class="info-tip" type="button" aria-label="Early adopter placement information" title="Lower square numbers and early claims are visibly scarce as the grid fills.">i</button>
          </li>
          <li>
            <span>Search visibility</span>
            <button class="info-tip" type="button" aria-label="Search visibility information" title="A simple public link gives crawlers another discoverable path to your site.">i</button>
          </li>
          <li>
            <span>AI-search discoverability</span>
            <button class="info-tip" type="button" aria-label="AI-search discoverability information" title="Public, crawlable links can be discovered by search and AI indexing systems.">i</button>
          </li>
        </ul>
      </footer>
    </main>

    <script>window.__PAID_SQUARES__ = ${squaresJson};</script>
    <script src="/assets/app.js" defer></script>
  </body>
</html>`;
}

function successPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Square claimed | Link for a Dollar</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/app.css">
  </head>
  <body>
    <main class="message-page">
      <h1>Square claimed</h1>
      <p>Your link is now live on the home page.</p>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>`;
}

function messagePage(message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Link for a Dollar</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/app.css">
  </head>
  <body>
    <main class="message-page">
      <h1>Something needs attention</h1>
      <p>${escapeHtml(message)}</p>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function css() {
  return `:root {
  color-scheme: light;
  --ink: #17140f;
  --muted: #6b6258;
  --line: #d9d1c6;
  --paper: #f7f3ec;
  --panel: #fffaf2;
  --accent: #0b776f;
  --accent-dark: #075b55;
  --claimed: #e44c36;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page-shell {
  width: min(1440px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 0;
}

.masthead {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.hero-copy {
  display: grid;
  gap: 8px;
}

.hero-kicker {
  margin: 0;
  color: var(--ink);
  font-size: clamp(1.8rem, 4.8vw, 5.2rem);
  font-weight: 950;
  line-height: 0.94;
  text-transform: uppercase;
  max-width: 10ch;
}

.hero-subhead {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: clamp(1.05rem, 1.8vw, 1.55rem);
  font-weight: 800;
  line-height: 1.25;
  max-width: 36rem;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--accent-dark);
  font-size: clamp(1.8rem, 4vw, 4.25rem);
  line-height: 0.96;
}

.stats {
  display: grid;
  gap: 2px;
  min-width: 120px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  background: var(--panel);
}

.stats strong {
  font-size: 1.8rem;
}

.stats span {
  color: var(--muted);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
  align-items: start;
}

.canvas-panel {
  overflow: auto;
  border: 1px solid var(--line);
  background: #ffffff;
  max-height: calc(100vh - 160px);
}

#grid {
  display: block;
  width: min(1000px, 100%);
  height: auto;
  image-rendering: pixelated;
  cursor: crosshair;
}

.claim-panel {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--line);
  background: var(--panel);
}

.claim-copy {
  display: grid;
  gap: 10px;
}

.claim-copy h2 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.05;
}

.claim-benefits {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  font-weight: 700;
}

form {
  display: grid;
  gap: 14px;
}

.field-row {
  display: grid;
  gap: 6px;
}

label {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  padding: 11px 12px;
}

button,
.button-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 800;
  min-height: 44px;
  padding: 0 16px;
  text-decoration: none;
  cursor: pointer;
}

button:hover,
.button-link:hover {
  background: var(--accent-dark);
}

.selection {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.selection span {
  color: var(--muted);
}

.selection strong {
  font-size: 1.6rem;
}

.selection a {
  color: var(--accent-dark);
  font-weight: 700;
}

.selection a[hidden] {
  display: none;
}

.seo-footer {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
  padding: 18px;
  border: 1px solid var(--line);
  background: #ffffff;
}

.footer-about {
  display: grid;
  align-content: start;
  gap: 10px;
}

.footer-about h2 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.05;
}

.footer-about p {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.value-props {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.value-props li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 46px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-weight: 800;
}

.info-tip {
  flex: 0 0 auto;
  width: 22px;
  min-height: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--accent-dark);
  font-size: 0.75rem;
  font-weight: 900;
  line-height: 1;
  padding: 0;
}

.info-tip:hover,
.info-tip:focus-visible {
  background: var(--accent);
  color: #fff;
  outline: none;
}

.message-page {
  display: grid;
  gap: 16px;
  width: min(560px, calc(100vw - 32px));
  margin: 15vh auto;
}

.message-page p {
  color: var(--muted);
  font-size: 1.1rem;
}

@media (max-width: 900px) {
  .masthead,
  .workspace {
    display: grid;
    grid-template-columns: 1fr;
  }

  .claim-panel {
    position: static;
  }

  .seo-footer,
  .value-props {
    grid-template-columns: 1fr;
  }
}`;
}

function clientJs() {
  return `const canvas = document.getElementById("grid");
const context = canvas.getContext("2d");
const squareInput = document.getElementById("square_id");
const selectedLabel = document.getElementById("selectedLabel");
const selectedLink = document.getElementById("selectedLink");
const claimedCount = document.getElementById("claimedCount");

const paidSquares = new Map(
  (window.__PAID_SQUARES__ || []).map((square) => [
    Number(square.square_id),
    { label: square.label, url: square.url },
  ]),
);
let selectedId = Number(squareInput.value || 1) - 1;

function createBasePixels() {
  const imageData = context.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const tone = (x + y) % 2 === 0 ? 238 : 246;
      imageData.data[offset] = tone;
      imageData.data[offset + 1] = tone - 4;
      imageData.data[offset + 2] = tone - 12;
      imageData.data[offset + 3] = 255;
    }
  }

  return imageData;
}

const basePixels = createBasePixels();

function drawGrid() {
  context.putImageData(basePixels, 0, 0);

  context.fillStyle = "#e44c36";
  for (const id of paidSquares.keys()) {
    context.fillRect(id % 1000, Math.floor(id / 1000), 1, 1);
  }

  const x = selectedId % 1000;
  const y = Math.floor(selectedId / 1000);
  context.strokeStyle = "#0b776f";
  context.lineWidth = 2;
  context.strokeRect(Math.max(0, x - 4), Math.max(0, y - 4), 9, 9);
}

function selectSquare(squareId) {
  const boundedId = Math.max(0, Math.min(999999, squareId));
  const claimed = paidSquares.get(boundedId);
  selectedId = boundedId;

  squareInput.value = String(boundedId + 1);
  selectedLabel.textContent = \`#\${boundedId + 1}\${claimed ? \` · \${claimed.label}\` : ""}\`;

  if (claimed) {
    selectedLink.href = claimed.url;
    selectedLink.hidden = false;
  } else {
    selectedLink.hidden = true;
  }

  drawGrid();
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
  selectSquare(y * 1000 + x);
});

squareInput.addEventListener("input", () => {
  selectSquare(Number(squareInput.value || 1) - 1);
});

selectSquare(Number(squareInput.value || 1) - 1);
claimedCount.textContent = String(paidSquares.size);`;
}

function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#f7f3ec"/>
  <g fill="#0b776f">
    <rect x="10" y="10" width="12" height="12"/>
    <rect x="26" y="10" width="12" height="12"/>
    <rect x="42" y="10" width="12" height="12"/>
    <rect x="10" y="26" width="12" height="12"/>
    <rect x="26" y="26" width="12" height="12"/>
    <rect x="42" y="26" width="12" height="12"/>
    <rect x="10" y="42" width="12" height="12"/>
    <rect x="26" y="42" width="12" height="12"/>
    <rect x="42" y="42" width="12" height="12"/>
  </g>
</svg>`;
}
