<?php

$squaresJson = json_encode($paidSquares, JSON_THROW_ON_ERROR);
$totalTraffic = array_sum(array_map(static fn (array $square): int => (int) ($square['click_count'] ?? 0), $paidSquares));
$totalPaymentsCents = array_sum(array_map(static fn (array $square): int => (int) ($square['featured_amount_cents'] ?? 0), $paidSquares));

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Link for a Dollar | The Permanent Link Leaderboard', 'Claim a permanent branded listing for $1, then compete for the #1 position on the live link leaderboard.', '/') ?>
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
    <script type="application/ld+json">
      <?= json_encode([
          '@context' => 'https://schema.org',
          '@type' => 'WebSite',
          'name' => 'Link for a Dollar',
          'url' => app_url('/'),
          'description' => 'A public million-square board for permanent company claim pages, sponsored links, and indexed owner profiles.',
      ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>
    </script>
  </head>
  <body data-directory-mode="true">
    <main class="page-shell">
      <section class="masthead">
        <a class="list-brand" href="/">Link for a Dollar</a>
        <div class="hero-copy">
          <p class="hero-kicker">Permanent listing. Live competition.</p>
          <h1>The link leaderboard. <em>The highest active bid takes #1.</em></h1>
          <p class="hero-subhead">No ads. No algorithms. Claim a permanent branded listing for $1, then promote it for as long as you choose. Every click lands on your site.</p>
          <section class="inline-claim" id="claimForm" aria-labelledby="claim-form-title">
            <h2 id="claim-form-title">Choose what you want to pay</h2>
            <p>Pay from $1 for any available rank, or enter enough to take the top spot.</p>
            <form action="/checkout" method="post">
              <input id="label" name="label" type="hidden" value="Website">
              <input name="category" type="hidden" value="Other">
              <input name="promotion_type" type="hidden" value="bid">
              <div class="bid-amount" aria-labelledby="bid-amount-label">
                <span id="bid-amount-label">Your payment</span>
                <div class="bid-stepper">
                  <button type="button" data-adjust-bid="-1" aria-label="Subtract one dollar">−</button>
                  <label class="bid-value" for="payment_level"><span aria-hidden="true">$</span><input id="payment_level" name="payment_level" type="number" min="1" max="999999" step="1" value="1" inputmode="numeric" required aria-describedby="placementPreview"></label>
                  <button type="button" data-adjust-bid="1" aria-label="Add one dollar">+</button>
                </div>
                <div class="bid-increments" aria-label="Adjust payment amount">
                  <button type="button" data-adjust-bid="-10">−$10</button>
                  <button type="button" data-adjust-bid="-5">−$5</button>
                  <button type="button" data-adjust-bid="5">+$5</button>
                  <button type="button" data-adjust-bid="10">+$10</button>
                  <button class="take-top-button" type="button" data-take-top>Take #1</button>
                </div>
              </div>
              <label class="website-input" for="url"><span class="sr-only">Your website</span><input id="url" name="url" type="url" placeholder="https://yourwebsite.com" autocomplete="url" required></label>
              <p id="placementPreview" class="placement-preview" aria-live="polite">$1 gets your website listed. The current #1 amount will appear here.</p>
              <button id="checkoutButton" type="submit">Continue to Stripe · $1</button>
            </form>
          </section>
          <dl class="lifetime-totals" aria-label="All-time marketplace totals">
            <div><dt>Total paid</dt><dd>$<?= number_format($totalPaymentsCents / 100, $totalPaymentsCents % 100 === 0 ? 0 : 2) ?></dd></div>
            <div><dt>Outbound clicks</dt><dd><?= number_format($totalTraffic) ?></dd></div>
          </dl>
        </div>
        <div class="stats live-stats" aria-label="Live site activity" aria-live="polite">
          <span class="live-stats__status"><i aria-hidden="true"></i><strong id="activeNow">—</strong> active now</span>
          <span class="live-stats__divider" aria-hidden="true">·</span>
          <span><strong id="sessions24h">—</strong> sessions in 24h</span>
          <span class="sr-only" id="presenceStatus">Loading live activity</span>
          <a href="/stats">Stats</a>
        </div>
      </section>

      <section class="momentum-strip" aria-label="Live claim momentum">
        <div class="momentum-card">
          <span>Recently claimed</span>
          <strong id="latestClaim">Waiting for the first claim</strong>
        </div>
        <div class="momentum-card">
          <span>Today</span>
          <strong id="claimedToday">0 squares claimed today</strong>
        </div>
        <div class="momentum-card">
          <span>Fastest growing</span>
          <strong id="fastestCategory">Categories open</strong>
        </div>
        <div class="momentum-card activity-card">
          <span>Live activity</span>
          <strong id="liveActivity">Watching the grid</strong>
        </div>
      </section>

      <section class="workspace" aria-label="One million link squares">
        <div class="canvas-panel">
          <div class="board-toolbar" aria-label="Board controls">
            <div class="search-control">
              <label class="sr-only" for="companySearch">Search companies</label>
              <input id="companySearch" type="search" placeholder="Search brands or URLs">
              <div id="searchResults" class="search-results" hidden></div>
            </div>
            <select id="categoryFilter" aria-label="Filter board by category">
              <option value="All">All categories</option>
              <option value="AI">AI</option>
              <option value="SaaS">SaaS</option>
              <option value="Ecommerce">Ecommerce</option>
              <option value="Agency">Agency</option>
              <option value="Media">Media</option>
              <option value="Developer tools">Developer tools</option>
              <option value="Finance">Finance</option>
              <option value="Local business">Local business</option>
              <option value="Other">Other</option>
            </select>
            <div class="view-toggle" role="group" aria-label="Choose board view">
              <button class="view-toggle__button is-active" id="listViewButton" type="button" aria-pressed="true" aria-controls="directoryList">List</button>
              <button class="view-toggle__button" id="gridViewButton" type="button" aria-pressed="false" aria-controls="directoryList">Grid</button>
              <button class="view-toggle__button" id="mapViewButton" type="button" aria-pressed="false" aria-controls="purchaseMap">Map</button>
            </div>
            <div class="zoom-controls" aria-label="Zoom controls">
              <button class="tool-button" id="zoomOut" type="button" aria-label="Zoom out">-</button>
              <input id="zoomRange" class="zoom-range" type="range" min="1" max="32" step="1" value="4" aria-label="Zoom level">
              <button class="tool-button" id="zoomIn" type="button" aria-label="Zoom in">+</button>
              <button class="tool-button wide" id="zoomHome" type="button">Fit</button>
            </div>
          </div>
          <canvas id="grid" width="1000" height="1000" aria-label="One million selectable squares"></canvas>
          <div id="directoryList" class="directory-list" aria-label="Claimed link directory" hidden>
            <div class="directory-list__header">
              <div>
                <p class="eyebrow">Claimed links</p>
                <h2>Link leaderboard</h2>
              </div>
              <p id="directoryCount" class="directory-list__count"></p>
            </div>
            <ol id="directoryRows" class="directory-rows"></ol>
          </div>
          <section id="purchaseMapPanel" class="purchase-map-panel" aria-labelledby="purchase-map-title" hidden>
            <div class="directory-list__header">
              <div>
                <p class="eyebrow">Listing locations</p>
                <h2 id="purchase-map-title">Claimed links around the world</h2>
              </div>
              <p id="mapLocationCount" class="directory-list__count"></p>
            </div>
            <div id="purchaseMap" class="purchase-map" aria-label="World map of approximate listing locations"></div>
            <div id="mapEmptyState" class="map-empty-state" hidden>
              <strong>The map is ready for its first location</strong>
              <span>New claims appear here using an approximate headquarters or checkout location.</span>
              <button type="button" data-focus-claim>Claim the first mapped link</button>
            </div>
            <p class="map-privacy-note">Markers show buyer-selected country centres from OpenStreetMap or approximate legacy locations. We do not store IP addresses.</p>
          </section>
          <div class="hover-preview" id="hoverPreview" hidden></div>
        </div>

      </section>

      <section class="trending-section" aria-labelledby="trending-title">
        <div>
          <p class="eyebrow">Trending squares</p>
          <h2 id="trending-title">Fresh claims on the board</h2>
        </div>
        <div id="trendingSquares" class="trending-grid"></div>
      </section>

      <footer class="seo-footer" aria-labelledby="seo-footer-title">
        <div class="footer-about">
          <p class="eyebrow">About</p>
          <h2 id="seo-footer-title">Why teams buy a square</h2>
          <p>
            One dollar buys a permanent public profile, a sponsored outbound link, and a shareable place on a million-square board built for early adopters.
          </p>
        </div>
        <ul class="value-props" aria-label="Public claim value props">
          <li>
            <span>Permanent public profile</span>
            <button class="info-tip" type="button" aria-label="Permanent public profile information" title="Paid squares create a crawlable public claim page.">i</button>
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

    <script>
      window.__PAID_SQUARES__ = <?= $squaresJson ?>;
    </script>
    <script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js" defer></script>
    <script src="/assets/app.js?v=20260822-recurring-funnel-2" defer></script>
  </body>
</html>
