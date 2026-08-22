<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head('Square claimed | Link for a Dollar', 'Your paid public square is live on the Link for a Dollar discovery board.', '/success', 'noindex, follow') ?>
  </head>
  <body>
    <main class="message-page" aria-labelledby="success-title">
      <p class="eyebrow">Payment confirmed</p>
      <h1 id="success-title">Square claimed</h1>
      <p>Your listing is live. View it on the board and start sharing your public claim.</p>
      <a class="button-link" href="/">View the board</a>
    </main>
    <?php if (!empty($conversion)): ?>
      <script>
        window.addEventListener('load', function () {
          var props = <?= json_encode($conversion, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?>;
          if (!window.piqo) return;
          var storageKey = 'piqo:purchase:' + props.order_id;
          try {
            if (sessionStorage.getItem(storageKey)) return;
            sessionStorage.setItem(storageKey, '1');
          } catch (_) {}
          window.piqo('event', 'purchase', props);
        }, { once: true });
      </script>
    <?php endif; ?>
  </body>
</html>
