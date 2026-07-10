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

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Stats | Link for a Dollar', 'See the Link for a Dollar leaderboard across genuine paid squares, owners, categories, territories, and tracked outbound visits.', '/stats') ?>
  </head>
  <body>
    <main class="page-shell stats-page">
      <header class="stats-hero">
        <div>
          <p class="eyebrow">Stats</p>
          <h1>Leaderboard</h1>
          <p>The public scoreboard for traffic, territory, recency, and founding claims.</p>
        </div>
        <a class="button-link secondary" href="/">Back to the grid</a>
      </header>

      <section class="stats-summary" aria-label="Board summary">
        <div><span>Claimed squares</span><strong><?= $formatNumber((int) $summary['claimed']) ?></strong></div>
        <div><span>Owners</span><strong><?= $formatNumber((int) $summary['owners']) ?></strong></div>
        <div><span>Territories</span><strong><?= $formatNumber((int) $summary['territories']) ?></strong></div>
        <div><span>Total clicks</span><strong><?= $formatNumber((int) $summary['clicks']) ?></strong></div>
      </section>

      <section class="stats-grid" aria-label="Rankings">
        <article class="stats-board">
          <p class="eyebrow">Leaderboard</p>
          <h2>Top Performing</h2>
          <ol class="rank-list">
            <?php foreach ($stats['topPerforming'] as $square) : ?>
              <li>
                <a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a>
                <span><?= htmlspecialchars(host_from_url($square['url']), ENT_QUOTES) ?></span>
                <strong><?= $formatNumber((int) $square['click_count']) ?> clicks</strong>
              </li>
            <?php endforeach; ?>
          </ol>
        </article>

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

        <article class="stats-board stats-board--wide">
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
