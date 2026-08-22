<?php

$squaresJson = json_encode($paidSquares, JSON_THROW_ON_ERROR);

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
          <button class="hero-claim-button" type="button" data-open-claim>Claim #1 →</button>
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

        <dialog class="claim-dialog" id="claimDialog" aria-labelledby="claim-dialog-title">
          <button class="claim-dialog__close" type="button" data-close-claim aria-label="Close claim form">×</button>
        <aside class="claim-panel">
          <div class="claim-copy">
            <p class="eyebrow">Featured placement</p>
            <h2 id="claim-dialog-title">Claim #1 for as long as you choose</h2>
            <ul class="claim-benefits">
              <li>Your listing stays permanently</li>
              <li>Bid for rank without choosing a square</li>
              <li>Choose a custom bid or a one-time 30-day placement</li>
            </ul>
            <p class="rebid-note"><strong>Outbid or be outbid.</strong> Enter the same URL again and your previous bid is credited. We automatically calculate the amount needed to return to #1.</p>
          </div>

          <form action="/checkout" method="post">
            <div class="field-row">
              <label for="label">Friendly title</label>
              <input id="label" name="label" maxlength="80" placeholder="What should we call you?" required>
            </div>
            <div class="field-row">
              <label for="url">Your website</label>
              <input id="url" name="url" type="url" placeholder="https://yourwebsite.com" required>
            </div>
            <div class="field-row logo-field">
              <label for="logo_url">Logo URL <span>(optional)</span></label>
              <input id="logo_url" name="logo_url" type="url" maxlength="500" placeholder="https://yourwebsite.com/logo.png">
            </div>
            <div class="field-row">
              <label for="country">Country <span>(optional)</span></label>
              <input id="country" name="country" maxlength="80" autocomplete="country-name" placeholder="Australia">
              <small>Used only to place your listing at the country centre on the public map.</small>
            </div>
            <div class="field-row description-field">
              <label for="description">Friendly description <span>(optional)</span></label>
              <textarea id="description" name="description" maxlength="180" rows="2" placeholder="A short, human introduction to what you do"></textarea>
            </div>
            <div class="field-row">
              <label for="category">Category</label>
              <select id="category" name="category">
                <option>AI</option>
                <option>SaaS</option>
                <option>Ecommerce</option>
                <option>Agency</option>
                <option>Media</option>
                <option>Developer tools</option>
                <option>Finance</option>
                <option>Local business</option>
                <option selected>Other</option>
              </select>
            </div>
            <div class="field-row">
              <label for="promotion_type">Placement</label>
              <select id="promotion_type" name="promotion_type">
                <option value="bid">Custom rank bid</option>
                <option value="monthly">30-day top placement</option>
              </select>
            </div>
            <div class="field-row payment-level-field">
              <label for="payment_level">Promotion amount</label>
              <div class="money-input">
                <span aria-hidden="true">$</span>
                <input id="payment_level" name="payment_level" type="number" min="1" max="10000" step="1" value="1" required aria-describedby="placementPreview">
              </div>
              <small id="placementPreview">Your first $1 publishes the listing permanently. Additional dollars buy more time at #1.</small>
            </div>
            <div class="field-row">
              <label for="email">Ownership receipt</label>
              <input id="email" name="email" type="email" placeholder="you@example.com">
            </div>
            <div class="field-row">
              <label for="anchor_text">Anchor text</label>
              <input id="anchor_text" name="anchor_text" maxlength="80" placeholder="Primary search phrase">
            </div>
            <div class="field-row">
              <label for="link_attribute">Link attribute</label>
              <select id="link_attribute" name="link_attribute">
                <option value="sponsored" selected>Sponsored public link</option>
                <option value="nofollow">Nofollow public link</option>
              </select>
            </div>
            <p class="auto-brand-note">We’ll suggest a title from your website. Add your own logo and a short introduction to make the listing feel like you.</p>
            <button id="checkoutButton" type="submit">Claim my spot</button>
          </form>

          <div class="selection" hidden>
            <span>Listing</span>
            <strong id="selectedLabel">Ready</strong>
            <a id="selectedLink" href="#" target="_blank" rel="noopener">Open claimed link</a>
            <div class="selected-card" id="selectedCard"></div>
          </div>

          <div class="proof-panel" aria-labelledby="featured-title">
            <p class="eyebrow">Leaderboard</p>
            <h2 id="featured-title">Top performing</h2>
            <div class="proof-group">
              <ul id="featuredSquares" class="proof-list"></ul>
            </div>
          </div>

          <div class="proof-panel" aria-labelledby="proof-title">
            <p class="eyebrow">Live board</p>
            <h2 id="proof-title">Activity and rankings</h2>
            <div class="proof-group">
              <h3>Notable brands</h3>
              <ul id="notableBrands" class="proof-list"></ul>
            </div>
            <div class="proof-group">
              <h3>Recently claimed</h3>
              <ul id="newestSquares" class="proof-list"></ul>
            </div>
            <div class="proof-group">
              <h3>Top categories</h3>
              <ul id="topCategories" class="proof-list compact"></ul>
            </div>
            <div class="proof-group">
              <h3>Leaderboards</h3>
              <ul id="mostClicked" class="proof-list"></ul>
            </div>
          </div>
        </aside>
        </dialog>
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
    <script src="/assets/app.js?v=20260822-checkout" defer></script>
  </body>
</html>
