<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Page not found | Link for a Dollar', 'The requested Link for a Dollar page could not be found. Return to the public discovery board.', null, 'noindex, follow') ?>
  </head>
  <body>
    <main class="message-page">
      <h1>Something needs attention</h1>
      <p><?= htmlspecialchars($message ?? 'Unexpected error.', ENT_QUOTES, 'UTF-8') ?></p>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>
