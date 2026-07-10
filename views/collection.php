<?php

$categoryLabel = htmlspecialchars($category, ENT_QUOTES);
$description = 'Browse genuine paid ' . $category . ' listings on Link for a Dollar, with public square pages, owner profiles, and tracked visits.';

?><!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head($category . ' listings | Link for a Dollar', $description, '/collections/' . rawurlencode($category)) ?>
  </head>
  <body>
    <main class="message-page collection-page">
      <p class="eyebrow">Collection</p>
      <h1><?= $categoryLabel ?></h1>
      <p><?= count($squares) ?> claimed squares in this category.</p>
      <ol class="collection-list">
        <?php foreach (array_slice($squares, 0, 50) as $square) : ?>
          <li>
            <a href="<?= htmlspecialchars($square['url'], ENT_QUOTES) ?>" rel="sponsored noopener"><?= htmlspecialchars($square['label'], ENT_QUOTES) ?></a>
            <span>#<?= (int) $square['square_id'] + 1 ?> · <?= (int) $square['click_count'] ?> clicks</span>
          </li>
        <?php endforeach; ?>
      </ol>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>
