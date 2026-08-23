<?php
$summary = $stats['summary'];
$formatNumber = static fn (int $value): string => number_format($value);
$squareHref = static fn (array $square): string => '/squares/' . ((int) $square['square_id'] + 1);
$profileHref = static fn (array $owner): string => '/profile/' . rawurlencode($owner['host']);
$paidDate = static function (?string $value): string {
    if (!$value) return 'First wave';
    $timestamp = strtotime($value);
    return $timestamp ? date('M j, Y', $timestamp) : 'First wave';
};
$clickedListings = array_values(array_filter($stats['topPerforming'], static fn (array $square): bool => (int) ($square['click_count'] ?? 0) > 0));
$maxClicks = max(0, ...array_map(static fn (array $square): int => (int) ($square['click_count'] ?? 0), $clickedListings));
$maxCategoryCount = max(0, ...array_map(static fn (array $category): int => (int) ($category['square_count'] ?? 0), $stats['categoriesByListings']));
$boardFill = ((int) $summary['claimed'] / TOTAL_SQUARES) * 100;
$topThree = array_slice($clickedListings, 0, 3);
$podiumClasses = ['gold', 'silver', 'bronze'];
$podiumMedals = ['🥇', '🥈', '🥉'];
?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Leaderboard | Link for a Dollar', 'Meet the Traffic Titans, Link Lords, Fresh Drops, and category champions on the live Link for a Dollar leaderboard.', '/stats') ?>
  </head>
  <body data-stats-mode="true">
    <main class="page-shell stats-page">
      <header class="stats-hero">
        <div>
          <p class="eyebrow">The million-link scoreboard</p>
          <h1>Big links.<br><span>Loud numbers.</span></h1>
          <p>The live, slightly ridiculous race to fill one million spots—ranked by real claims and tracked outbound clicks.</p>
        </div>
        <a class="button-link" href="/">Get on the board</a>
      </header>

      <section class="stats-summary" aria-label="Leaderboard headline metrics">
        <div class="stats-summary__live"><span>Party right now</span><strong id="statsActiveNow" aria-label="Loading online visitors">—</strong><small>Active humans in the last 5 minutes</small></div>
        <div class="stats-summary__live"><span>Daily crowd</span><strong id="statsSessions24h" aria-label="Loading 24 hour visitors">—</strong><small>Anonymous browser sessions in 24h</small></div>
        <div><span>Links in the wild</span><strong><?= $formatNumber((int) $summary['claimed']) ?></strong><small>Permanent spots out there doing their thing</small></div>
        <div><span>Brand party</span><strong><?= $formatNumber((int) $summary['owners']) ?></strong><small>Unique sites have joined the board</small></div>
        <div><span>Clicks unleashed</span><strong><?= $formatNumber((int) $summary['clicks']) ?></strong><small>Tracked visits sent beyond the board</small></div>
        <div class="stats-summary__quest"><span>Million-link quest</span><strong><?= number_format($boardFill, 3) ?>%</strong><small><?= $formatNumber(TOTAL_SQUARES - (int) $summary['claimed']) ?> glorious spots still up for grabs</small></div>
      </section>

      <section class="stats-podium" aria-labelledby="traffic-titans-title">
        <div class="stats-section-heading"><div><p class="eyebrow">Main event</p><h2 id="traffic-titans-title">Traffic Titans</h2></div><p>The three links sending the most curious humans onward.</p></div>
        <ol class="podium-list">
          <?php foreach ($topThree as $index => $square) : ?>
            <li class="podium-card podium-card--<?= $podiumClasses[$index] ?>">
              <span class="podium-card__medal" aria-label="Place <?= $index + 1 ?>"><?= $podiumMedals[$index] ?></span>
              <div><span class="podium-card__place">#<?= $index + 1 ?> traffic titan</span><a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a></div>
              <strong><?= $formatNumber((int) ($square['click_count'] ?? 0)) ?><small> clicks</small></strong>
            </li>
          <?php endforeach; ?>
          <?php if (!$topThree) : ?><li class="podium-empty"><strong>The throne is open</strong><span>No tracked outbound clicks yet.</span><a class="button-link" href="/">Claim a link and start the race</a></li><?php endif; ?>
        </ol>
      </section>

      <section class="stats-charts" aria-label="Leaderboard charts">
        <figure class="stats-board stats-chart">
          <figcaption><p class="eyebrow">The chase pack</p><h2>Click Magnets</h2><p>Every tracked outbound visit, ranked. Longer bars mean stronger internet gravity.</p></figcaption>
          <ol class="stats-chart__rows" aria-label="Outbound clicks by listing">
            <?php foreach (array_slice($clickedListings, 0, 8) as $square) : $clicks = (int) ($square['click_count'] ?? 0); $size = max(5, (int) round(($clicks / $maxClicks) * 100)); ?>
              <li><a href="<?= $squareHref($square) ?>"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a><span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:<?= $size ?>%"></i></span><strong><?= $formatNumber($clicks) ?></strong></li>
            <?php endforeach; ?>
            <?php if (!$clickedListings) : ?><li class="stats-chart__empty"><a href="/">No outbound clicks yet — claim the first listing</a></li><?php endif; ?>
          </ol>
          <?php if ($maxClicks > 0) : ?><div class="stats-chart__axis" aria-hidden="true"><span>chilling</span><span><?= $formatNumber($maxClicks) ?> clicks</span></div><?php endif; ?>
        </figure>
        <figure class="stats-board stats-chart">
          <figcaption><p class="eyebrow">The genre wars</p><h2>Category Clash</h2><p>Which corners of the internet are claiming the most permanent territory?</p></figcaption>
          <ol class="stats-chart__rows" aria-label="Listings by category">
            <?php foreach (array_slice($stats['categoriesByListings'], 0, 8) as $category) : $count = (int) ($category['square_count'] ?? 0); $size = $count > 0 ? max(5, (int) round(($count / $maxCategoryCount) * 100)) : 0; ?>
              <li><a href="/collections/<?= rawurlencode($category['category']) ?>"><?= htmlspecialchars($category['category'], ENT_QUOTES) ?></a><span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:<?= $size ?>%"></i></span><strong><?= $formatNumber($count) ?></strong></li>
            <?php endforeach; ?>
          </ol>
          <div class="stats-chart__axis" aria-hidden="true"><span>just arrived</span><span><?= $formatNumber($maxCategoryCount) ?> links</span></div>
        </figure>
      </section>

      <section class="stats-grid" aria-label="More leaderboard rankings">
        <?php
        $boards = [
            ['Most links claimed', 'Link Lords', $stats['largestOwners'], 'owner'],
            ['Hot off the internet', 'Fresh Drops', $stats['recent'], 'recent'],
            ['They were here first', 'The OG Club', $stats['founding'], 'founding'],
            ['Clicks by category', 'Scene Stealers', $stats['categoriesByClicks'], 'category'],
        ];
        foreach ($boards as [$eyebrow, $title, $rows, $type]) : ?>
          <article class="stats-board">
            <p class="eyebrow"><?= $eyebrow ?></p><h2><?= $title ?></h2>
            <ol class="rank-list">
              <?php foreach ($rows as $index => $row) :
                if ($type === 'owner') { $href = $profileHref($row); $label = $row['label']; $sub = $row['host']; $metric = $formatNumber((int) $row['square_count']) . ' links'; }
                elseif ($type === 'category') { $href = '/collections/' . rawurlencode($row['category']); $label = $row['category']; $sub = $formatNumber((int) $row['square_count']) . ' live links'; $metric = $formatNumber((int) $row['click_count']) . ' clicks'; }
                else { $href = $squareHref($row); $label = $row['label']; $sub = $type === 'recent' ? $paidDate($row['paid_at'] ?? null) : host_from_url($row['url']); $metric = 'Spot ' . $formatNumber((int) $row['square_id'] + 1); }
              ?>
                <li><span class="rank-list__number">#<?= $index + 1 ?></span><div><a href="<?= $href ?>"><?= htmlspecialchars($label, ENT_QUOTES) ?></a><span><?= htmlspecialchars($sub, ENT_QUOTES) ?></span></div><strong><?= htmlspecialchars($metric, ENT_QUOTES) ?></strong></li>
              <?php endforeach; ?>
            </ol>
          </article>
        <?php endforeach; ?>
      </section>

      <footer class="stats-cta"><div><p class="eyebrow">Your move</p><h2>Think your link has main-character energy?</h2><p>Claim a permanent spot, climb the board, and give the leaderboard something new to talk about.</p></div><a class="button-link" href="/">Join the chaos</a></footer>
    </main>
    <script>
      (() => {
        const active = document.getElementById('statsActiveNow');
        const sessions = document.getElementById('statsSessions24h');
        let timer;
        async function refreshLiveStats() {
          if (document.hidden) return;
          let sessionId = sessionStorage.getItem('linkforadollar:presence');
          if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('linkforadollar:presence', sessionId); }
          try {
            const response = await fetch('/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }), cache: 'no-store' });
            if (!response.ok) throw new Error('Live audience unavailable');
            const data = await response.json();
            active.textContent = new Intl.NumberFormat().format(data.active_now);
            sessions.textContent = new Intl.NumberFormat().format(data.sessions_24h);
            active.removeAttribute('aria-label'); sessions.removeAttribute('aria-label');
          } catch { active.textContent = '—'; sessions.textContent = '—'; }
        }
        refreshLiveStats(); timer = setInterval(refreshLiveStats, 60_000);
        document.addEventListener('visibilitychange', refreshLiveStats);
        window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
      })();
    </script>
  </body>
</html>
