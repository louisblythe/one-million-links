# End-to-end coverage

`npm run test:e2e` starts an isolated local Worker and D1 database, applies every migration, and exercises the product in desktop and mobile Chromium. The local-only `E2E_TEST_MODE` replaces Stripe's hosted payment page with a deterministic paid-session confirmation; production never enables this variable.

Covered flows:

- Directory discovery: list, grid, map, view persistence, zoom, search, category filtering, location disclosure, and empty filtering.
- Claims: modal open/close, URL-to-brand inference, browser validation, expansion pricing, new listing checkout, paid confirmation, square publication, owner profile publication, and collection publication.
- Public content: about, stats, all four leaderboards, square, profile, and category collection pages.
- Platform contracts: squares and presence APIs, robots, sitemap index and core sitemap, RSS, JSON claims feed, manifest, social image, favicon, CSS, JavaScript, redirects, canonical metadata, noindex headers, and all principal 404 states.
- Responsive acceptance: mobile directory, claim modal, stats, map, and horizontal-overflow guard.

The real Stripe hosted UI remains Stripe-owned. Production payment integration is exercised up to and after that boundary using the same reservation and fulfilment code paths; webhook signature correctness remains a server-side integration concern rather than a browser flow.
