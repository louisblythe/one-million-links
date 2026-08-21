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

Checkout uses Stripe product `prod_Uam47pbENlHbmX` and creates a one-time price at the buyer's chosen whole-dollar payment level. The minimum is the selected territory price, the maximum is $365, and each dollar guarantees one full queued day in the #1 leaderboard position. Featured periods are assigned after confirmed payment and never displace an existing paid period.

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
