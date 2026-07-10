<?php

$squaresJson = json_encode($paidSquares, JSON_THROW_ON_ERROR);

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Link for a Dollar | Public Discovery Board', 'Claim a permanent public profile and sponsored link on a million-square discovery board for one dollar.', '/') ?>
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
  <body>
    <main class="page-shell">
      <section class="masthead">
        <div class="hero-copy">
          <p class="hero-kicker">Own a pixel of the internet</p>
          <h1>Link for a Dollar</h1>
          <p class="hero-subhead">1,000,000 permanent public spots. Claim yours, share the card, and give people another way to discover your site.</p>
        </div>
        <div class="stats">
          <strong id="claimedCount"><?= count($paidSquares) ?></strong>
          <span>claimed</span>
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
            <div class="zoom-controls" aria-label="Zoom controls">
              <button class="tool-button" id="zoomOut" type="button" aria-label="Zoom out">-</button>
              <input id="zoomRange" class="zoom-range" type="range" min="1" max="32" step="1" value="4" aria-label="Zoom level">
              <button class="tool-button" id="zoomIn" type="button" aria-label="Zoom in">+</button>
              <button class="tool-button wide" id="zoomHome" type="button">Fit</button>
            </div>
          </div>
          <canvas id="grid" width="1000" height="1000" aria-label="One million selectable squares"></canvas>
          <div class="hover-preview" id="hoverPreview" hidden></div>
        </div>

        <aside class="claim-panel">
          <div class="claim-copy">
            <p class="eyebrow">Public claim</p>
            <h2>Own permanent discovery real estate</h2>
            <ul class="claim-benefits">
              <li>Add your brand to the wall</li>
              <li>Get a shareable claim page</li>
              <li>Secure your square before it is gone</li>
            </ul>
          </div>

          <form action="/checkout" method="post">
            <div class="field-row">
              <label for="square_id">Homepage spot</label>
              <input id="square_id" name="square_id" type="number" min="1" max="1000000" value="<?= (int) $selectedSquare ?>" required>
            </div>
            <div class="field-row">
              <label for="label">Brand on the wall</label>
              <input id="label" name="label" maxlength="80" placeholder="Your brand" required>
            </div>
            <div class="field-row">
              <label for="url">Link destination</label>
              <input id="url" name="url" type="url" placeholder="https://example.com" required>
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
              <label for="pack_size">Expansion</label>
              <select id="pack_size" name="pack_size">
                <option value="1">1 square - $1</option>
                <option value="4">2x2 territory - $4</option>
                <option value="10">10 connected squares - $10</option>
                <option value="25">5x5 territory - $25</option>
              </select>
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
            <button id="checkoutButton" type="submit">Claim 1 square for $1</button>
          </form>

          <div class="selection">
            <span>Selected</span>
            <strong id="selectedLabel">#<?= (int) $selectedSquare ?></strong>
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
    <script src="/assets/app.js?v=20260710-seo2" defer></script>
  </body>
</html>
