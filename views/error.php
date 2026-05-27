<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Link for a Dollar</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/app.css">
  </head>
  <body>
    <main class="message-page">
      <h1>Something needs attention</h1>
      <p><?= htmlspecialchars($message ?? 'Unexpected error.', ENT_QUOTES, 'UTF-8') ?></p>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>
