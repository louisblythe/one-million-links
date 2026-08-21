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

Checkout uses Stripe product `prod_Uam47pbENlHbmX` and creates a one-time price from the buyer's chosen cumulative bid. The bid must beat the highest active bid by at least $1 and cannot exceed $10,000. Returning buyers enter the exact same destination URL; their previous bid is credited and Stripe charges only the difference. Each newly paid dollar adds one day of featured time, and the highest active cumulative bid ranks #1.

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

Listen for `checkout.session.completed`.
