<?php

$squares = $profile['squares'];
$firstSquare = $squares[0]['square_id'] + 1;
$profileDescription = 'View ' . $profile['label'] . "'s purchaser-submitted Link for a Dollar profile, including paid squares, territories, category, and tracked visits.";

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head($profile['label'] . ' profile | Link for a Dollar', $profileDescription, '/profile/' . rawurlencode($profile['host'])) ?>
    <script type="application/ld+json">
      <?= json_encode([
          '@context' => 'https://schema.org',
          '@type' => $profile['verified_company'] ? 'Organization' : 'ProfilePage',
          'name' => $profile['label'],
          'url' => $profile['verified_company'] ? $profile['url'] : app_url('/profile/' . rawurlencode($profile['host'])),
          ...($profile['verified_company'] ? ['sameAs' => [$profile['url']]] : []),
          'description' => $profile['label'] . ' owns ' . $profile['square_count'] . ' squares on Link for a Dollar.',
          'additionalProperty' => [
              [
                  '@type' => 'PropertyValue',
                  'name' => 'Claimed squares',
                  'value' => (string) $profile['square_count'],
              ],
              [
                  '@type' => 'PropertyValue',
                  'name' => 'Tracked clicks',
                  'value' => (string) $profile['click_count'],
              ],
          ],
      ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>
    </script>
  </head>
  <body>
    <main class="message-page profile-page">
      <p class="eyebrow">Owner profile</p>
      <h1><?= htmlspecialchars($profile['label'], ENT_QUOTES) ?></h1>
      <p>
        <?= htmlspecialchars($profile['host'], ENT_QUOTES) ?>
        <?php if ($profile['verified_company']) : ?>
          <span class="verified-badge">Verified company</span>
        <?php endif; ?>
      </p>
      <dl class="profile-stats">
        <div><dt>Squares</dt><dd><?= (int) $profile['square_count'] ?></dd></div>
        <div><dt>Territories</dt><dd><?= (int) $profile['territory_count'] ?></dd></div>
        <div><dt>Clicks</dt><dd><?= (int) $profile['click_count'] ?></dd></div>
        <div><dt>Category</dt><dd><?= htmlspecialchars($profile['category'], ENT_QUOTES) ?></dd></div>
      </dl>
      <div class="profile-actions">
        <a class="button-link" href="/?square=<?= (int) $firstSquare ?>">View territory</a>
        <a class="button-link secondary" href="<?= htmlspecialchars($profile['url'], ENT_QUOTES) ?>" rel="sponsored noopener">Visit site</a>
        <a href="/go/<?= (int) $firstSquare ?>">Tracked visit</a>
      </div>
    </main>
  </body>
</html>
