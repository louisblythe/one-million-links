<?php

$squaresJson = json_encode($paidSquares, JSON_THROW_ON_ERROR);

?><!doctype html>
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
          <strong id="claimedCount"><?= count($paidSquares) ?></strong>
          <span>claimed</span>
        </div>
      </section>

      <section class="workspace" aria-label="One million link squares">
        <div class="canvas-panel">
          <div class="board-toolbar" aria-label="Board controls">
            <button class="tool-button" id="zoomOut" type="button" aria-label="Zoom out">-</button>
            <input id="zoomRange" class="zoom-range" type="range" min="1" max="32" step="1" value="4" aria-label="Zoom level">
            <button class="tool-button" id="zoomIn" type="button" aria-label="Zoom in">+</button>
            <button class="tool-button wide" id="zoomHome" type="button">Fit</button>
          </div>
          <canvas id="grid" width="1000" height="1000" aria-label="One million selectable squares"></canvas>
          <div class="hover-preview" id="hoverPreview" hidden></div>
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
              <input id="square_id" name="square_id" type="number" min="1" max="1000000" value="<?= (int) $selectedSquare ?>" required>
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
            <strong id="selectedLabel">#<?= (int) $selectedSquare ?></strong>
            <a id="selectedLink" href="#" target="_blank" rel="noopener">Open claimed link</a>
            <div class="selected-card" id="selectedCard"></div>
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

    <script>
      window.__PAID_SQUARES__ = <?= $squaresJson ?>;
    </script>
    <script src="/assets/app.js" defer></script>
  </body>
</html>
