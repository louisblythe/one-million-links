# Link for a Dollar

A PHP version of the one-million-grid concept for `linkforadollar.com`. The home page shows 1,000,000 selectable squares. Claims use Stripe Checkout, with a minimum of $1 per square.

## Setup

Cloudflare Workers is the production target for `linkforadollar.com`.

```bash
npm install
npx wrangler d1 create linkforadollar
```

Copy the returned D1 `database_id` into `wrangler.jsonc`, then apply the schema:

```bash
npm run d1:migrate:remote
```

Set production secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Checkout uses Stripe product `prod_Uam47pbENlHbmX` and charges the entered payment amount ($1–$999,999). Each successful one-time payment adds its actual charged amount to the listing's cumulative bid and one featured day per dollar. Returning buyers enter the exact same destination URL to add credit; public rebids preserve the existing listing's category, branding, and location. The highest active cumulative bid ranks #1.

Reservations are allocated atomically and new Checkout sessions carry a reservation key. Payment fulfilment, rank updates, and deduplication records commit together in a D1 transaction, including category sponsorships and monthly renewals. Ambiguous Stripe network failures retain the reservation so a potentially payable session cannot later publish another buyer's listing. These changes require no database migration.

The premium directory supports list, card-grid, and world-map modes from the same page shell. The map uses MapLibre GL JS with OpenFreeMap tiles. New Worker checkouts round Cloudflare purchase coordinates to two decimals and store only city, country, latitude, and longitude through Stripe metadata; IP addresses are not stored.

The five listings that predate location capture are backfilled with approximate public headquarters or regional coordinates and labelled `estimated_headquarters`; new locations are labelled `checkout`.

Deploy:

```bash
npm run deploy
```

The Worker config maps both `linkforadollar.com` and `www.linkforadollar.com` as Cloudflare Worker custom domains.

## PHP local prototype

```bash
composer install
cp .env.example .env
```

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_URL` in `.env`. Use `APP_URL=https://linkforadollar.com` in production.

Run locally:

```bash
composer serve
```

Open `http://127.0.0.1:8080`.

## Stripe webhook

Point Stripe webhooks at:

```text
https://linkforadollar.com/stripe/webhook
```

Listen for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `invoice.paid`. Checkout completion publishes the first paid rank bid; successful recurring invoices add the selected monthly amount to the cumulative bid. The renewal handler ignores `subscription_create` invoices and records invoice IDs idempotently so the initial payment and webhook retries cannot double-bump rank.


## Validation

```bash
npm run test:payments
npm run test:leaderboard-contract
npm run test:e2e
SEO_BASE_URL=http://127.0.0.1:8791 npm run test:seo
```

The SEO audit requires a running Worker at the selected URL. Payment regression tests use isolated local D1 via Miniflare and simulate Stripe responses, signed webhook deliveries, concurrent requests, and database failures. They do not charge cards or prove production provider configuration.
