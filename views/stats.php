<?php

$summary = $stats['summary'];

$formatNumber = static fn (int $value): string => number_format($value);
$squareHref = static fn (array $square): string => '/?square=' . ((int) $square['square_id'] + 1);
$profileHref = static fn (array $owner): string => '/profile/' . rawurlencode($owner['host']);
$paidDate = static function (?string $value): string {
    if (!$value) {
        return 'First wave';
    }

    $timestamp = strtotime($value);
    return $timestamp ? date('M j, Y', $timestamp) : 'First wave';
};
$maxClicks = max(1, ...array_map(static fn (array $square): int => (int) ($square['click_count'] ?? 0), $stats['topPerforming']));
$maxCategoryCount = max(1, ...array_map(static fn (array $category): int => (int) ($category['square_count'] ?? 0), $stats['categories']));

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Stats | Link for a Dollar', 'See the Link for a Dollar leaderboard across genuine paid squares, owners, categories, territories, and tracked outbound visits.', '/stats') ?>
  </head>
  <body data-stats-mode="true">
    <main class="page-shell stats-page">
      <header class="stats-hero">
        <div>
          <p class="eyebrow">Live board data</p>
          <h1>Every claim.<br><span>Clearly measured.</span></h1>
          <p>See which permanent listings are earning attention and how the board is growing.</p>
        </div>
        <a class="button-link" href="/">Explore the leaderboard</a>
      </header>

      <section class="stats-summary" aria-label="Board summary">
        <div><span>Live listings</span><strong><?= $formatNumber((int) $summary['claimed']) ?></strong><small>Permanent spots claimed</small></div>
        <div><span>Brands</span><strong><?= $formatNumber((int) $summary['owners']) ?></strong><small>Unique sites represented</small></div>
        <div><span>Claim groups</span><strong><?= $formatNumber((int) $summary['territories']) ?></strong><small>Individual and multi-spot claims</small></div>
        <div><span>Outbound clicks</span><strong><?= $formatNumber((int) $summary['clicks']) ?></strong><small>Visits sent to listed sites</small></div>
      </section>

      <section class="stats-charts" aria-label="Board charts">
        <figure class="stats-board stats-chart">
          <figcaption><p class="eyebrow">Traffic</p><h2>Clicks by listing</h2><p>Tracked visits sent from the board. Longer bars mean more visitors reached that site.</p></figcaption>
          <ol class="stats-chart__rows" aria-label="Outbound clicks by listing">
            <?php foreach (array_slice($stats['topPerforming'], 0, 8) as $square) : $clicks = (int) ($square['click_count'] ?? 0); $size = $clicks > 0 ? max(5, (int) round(($clicks / $maxClicks) * 100)) : 0; ?>
              <li><a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a><span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:<?= $size ?>%"></i></span><strong><?= $formatNumber($clicks) ?></strong></li>
            <?php endforeach; ?>
          </ol>
          <div class="stats-chart__axis" aria-hidden="true"><span>0</span><span><?= $formatNumber($maxClicks) ?> clicks</span></div>
        </figure>
        <figure class="stats-board stats-chart">
          <figcaption><p class="eyebrow">Board mix</p><h2>Listings by category</h2><p>How the claimed listings are distributed. Each value is the number of permanent spots.</p></figcaption>
          <ol class="stats-chart__rows" aria-label="Listings by category">
            <?php foreach (array_slice($stats['categories'], 0, 8) as $category) : $count = (int) ($category['square_count'] ?? 0); $size = $count > 0 ? max(5, (int) round(($count / $maxCategoryCount) * 100)) : 0; ?>
              <li><a href="/collections/<?= rawurlencode($category['category']) ?>"><?= htmlspecialchars($category['category'], ENT_QUOTES) ?></a><span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:<?= $size ?>%"></i></span><strong><?= $formatNumber($count) ?></strong></li>
            <?php endforeach; ?>
          </ol>
          <div class="stats-chart__axis" aria-hidden="true"><span>0</span><span><?= $formatNumber($maxCategoryCount) ?> listings</span></div>
        </figure>
      </section>

      <section class="stats-grid" aria-label="Rankings">
        <article class="stats-board">
          <p class="eyebrow">Territory</p>
          <h2>Top Landholders</h2>
          <ol class="rank-list">
            <?php foreach ($stats['largestOwners'] as $owner) : ?>
              <li>
                <a href="<?= $profileHref($owner) ?>"><?= htmlspecialchars($owner['label'], ENT_QUOTES) ?></a>
                <span><?= htmlspecialchars($owner['host'], ENT_QUOTES) ?></span>
                <strong><?= $formatNumber((int) $owner['square_count']) ?> squares</strong>
              </li>
            <?php endforeach; ?>
          </ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Momentum</p>
          <h2>Recently Claimed</h2>
          <ol class="rank-list">
            <?php foreach ($stats['recent'] as $square) : ?>
              <li>
                <a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a>
                <span><?= htmlspecialchars($paidDate($square['paid_at'] ?? null), ENT_QUOTES) ?></span>
                <strong>#<?= $formatNumber((int) $square['square_id'] + 1) ?></strong>
              </li>
            <?php endforeach; ?>
          </ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Provenance</p>
          <h2>Founding Squares</h2>
          <ol class="rank-list">
            <?php foreach ($stats['founding'] as $square) : ?>
              <li>
                <a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a>
                <span><?= htmlspecialchars(host_from_url($square['url']), ENT_QUOTES) ?></span>
                <strong>#<?= $formatNumber((int) $square['square_id'] + 1) ?></strong>
              </li>
            <?php endforeach; ?>
          </ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Categories</p>
          <h2>Category Leaders</h2>
          <ol class="rank-list category-rank-list">
            <?php foreach ($stats['categories'] as $category) : ?>
              <li>
                <a href="/collections/<?= rawurlencode($category['category']) ?>"><?= htmlspecialchars($category['category'], ENT_QUOTES) ?></a>
                <span><?= $formatNumber((int) $category['click_count']) ?> clicks</span>
                <strong><?= $formatNumber((int) $category['square_count']) ?> squares</strong>
              </li>
            <?php endforeach; ?>
          </ol>
        </article>
      </section>
    </main>
  </body>
</html>
