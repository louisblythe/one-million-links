<?php

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET' || $method === 'HEAD') {
        $preferred = parse_url(app_url('/'));
        $preferredHost = strtolower((string) ($preferred['host'] ?? 'linkforadollar.com'));
        $preferredScheme = strtolower((string) ($preferred['scheme'] ?? 'https'));
        $requestHost = strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0]);
        $requestScheme = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? (!empty($_SERVER['HTTPS']) ? 'https' : 'http')));
        $trailingSlash = $path !== '/' && str_ends_with($path, '/');

        if (in_array($requestHost, [$preferredHost, 'www.' . $preferredHost], true)
            && ($requestHost !== $preferredHost || $requestScheme !== $preferredScheme || $trailingSlash)) {
            $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
            if ($trailingSlash) {
                $requestUri = preg_replace('#/+(\?|$)#', '$1', $requestUri) ?: '/';
            }
            redirect_to($preferredScheme . '://' . $preferredHost . $requestUri, 301);
        }
    }

    if ($method === 'GET' && $path === '/') {
        render('home', [
            'paidSquares' => paid_squares(),
            'selectedSquare' => isset($_GET['square']) ? max(1, min(TOTAL_SQUARES, (int) $_GET['square'])) : 1,
        ]);
    }

    if ($method === 'GET' && $path === '/about') {
        render('about');
    }

    if ($method === 'GET' && $path === '/api/squares') {
        json_response(['squares' => paid_squares()]);
    }

    if ($method === 'GET' && $path === '/robots.txt') {
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\n";
        echo "Allow: /\n";
        echo "Disallow: /checkout\n";
        echo "Disallow: /go/\n";
        echo "Disallow: /stripe/\n";
        echo "\n";
        echo 'Sitemap: ' . app_url('/sitemap.xml') . "\n";
        exit;
    }

    if ($method === 'GET' && $path === '/sitemap.xml') {
        $squares = paid_squares();
        $categories = array_values(array_unique(array_map(static fn (array $square): string => $square['category'] ?: 'Other', $squares)));
        sort($categories);
        $hosts = array_values(array_unique(array_map(static fn (array $square): string => host_from_url($square['url']), $squares)));
        sort($hosts);
        $latest = array_reduce($squares, static fn (?string $carry, array $square): ?string => max($carry ?? '', (string) ($square['paid_at'] ?? '')) ?: null, null);
        $lastmod = static function (?string $value): string {
            $timestamp = $value ? strtotime($value) : false;
            return $timestamp ? date('Y-m-d', $timestamp) : date('Y-m-d');
        };
        $urls = [
            ['loc' => app_url('/'), 'lastmod' => $lastmod($latest), 'changefreq' => 'daily', 'priority' => '1.0'],
            ['loc' => app_url('/about'), 'lastmod' => $lastmod($latest), 'changefreq' => 'monthly', 'priority' => '0.6'],
            ['loc' => app_url('/stats'), 'lastmod' => $lastmod($latest), 'changefreq' => 'daily', 'priority' => '0.8'],
        ];

        foreach ($categories as $category) {
            $urls[] = ['loc' => app_url('/collections/' . rawurlencode($category)), 'lastmod' => $lastmod($latest), 'changefreq' => 'daily', 'priority' => '0.7'];
        }

        foreach ($hosts as $host) {
            $urls[] = ['loc' => app_url('/profile/' . rawurlencode($host)), 'lastmod' => $lastmod($latest), 'changefreq' => 'weekly', 'priority' => '0.6'];
        }

        header('Content-Type: application/xml; charset=utf-8');
        echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
        foreach ($urls as $url) {
            echo "  <url>\n";
            echo '    <loc>' . htmlspecialchars($url['loc'], ENT_XML1) . "</loc>\n";
            echo '    <lastmod>' . htmlspecialchars($url['lastmod'], ENT_XML1) . "</lastmod>\n";
            echo '    <changefreq>' . htmlspecialchars($url['changefreq'], ENT_XML1) . "</changefreq>\n";
            echo '    <priority>' . htmlspecialchars($url['priority'], ENT_XML1) . "</priority>\n";
            echo "  </url>\n";
        }
        echo "</urlset>\n";
        exit;
    }

    if ($method === 'GET' && $path === '/stats') {
        render('stats', ['stats' => stats_page_data()]);
    }

    if ($method === 'GET' && preg_match('#^/profile/([^/]+)$#', $path, $matches)) {
        $requestedHost = strtolower(rawurldecode($matches[1]));
        $canonicalPath = '/profile/' . rawurlencode($requestedHost);
        if ($path !== $canonicalPath) {
            redirect_to(app_url($canonicalPath), 301);
        }
        $profile = profile_for_host($requestedHost);

        if (!$profile) {
            http_response_code(404);
            header('X-Robots-Tag: noindex, follow');
            render('error', ['message' => 'That profile does not exist yet.']);
        }

        render('profile', ['profile' => $profile]);
    }

    if ($method === 'GET' && preg_match('#^/collections/([^/]+)$#', $path, $matches)) {
        $category = category_from_path(rawurldecode($matches[1]));
        if (!$category) {
            http_response_code(404);
            header('X-Robots-Tag: noindex, follow');
            render('error', ['message' => 'That collection does not exist.']);
        }
        $canonicalPath = '/collections/' . rawurlencode($category);
        if ($path !== $canonicalPath) {
            redirect_to(app_url($canonicalPath), 301);
        }
        $squares = array_values(array_filter(paid_squares(), fn (array $square): bool => $square['category'] === $category));

        if (!$squares) {
            http_response_code(404);
            header('X-Robots-Tag: noindex, follow');
            render('error', ['message' => 'That collection does not have any claimed squares yet.']);
        }

        render('collection', [
            'category' => $category,
            'squares' => $squares,
        ]);
    }

    if ($method === 'POST' && $path === '/checkout') {
        $squareId = validate_square_id(((int) ($_POST['square_id'] ?? 1)) - 1);
        $label = normalize_label((string) ($_POST['label'] ?? ''));
        $url = normalize_url((string) ($_POST['url'] ?? ''));
        $category = normalize_category((string) ($_POST['category'] ?? 'Other'));
        $packSize = normalize_pack_size($_POST['pack_size'] ?? 1);
        $email = trim((string) ($_POST['email'] ?? ''));
        $email = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
        $squareIds = reserve_squares($squareId, $packSize, $label, $url, $category, $email);

        configure_stripe();

        $session = \Stripe\Checkout\Session::create([
            'mode' => 'payment',
            'client_reference_id' => (string) $squareId,
            'customer_email' => $email,
            'success_url' => app_url('/success?session_id={CHECKOUT_SESSION_ID}'),
            'cancel_url' => app_url('/?square=' . ($squareId + 1) . '&cancelled=1'),
            'line_items' => [[
                'quantity' => count($squareIds),
                'price_data' => [
                    'currency' => strtolower(env_value('APP_CURRENCY', 'usd') ?? 'usd'),
                    'unit_amount' => 100,
                    'product' => env_value('STRIPE_PRODUCT_ID', 'prod_Uam47pbENlHbmX'),
                ],
            ]],
            'metadata' => [
                'square_id' => (string) $squareId,
                'label' => $label,
                'url' => $url,
                'category' => $category,
                'square_ids' => implode(',', $squareIds),
                'pack_size' => (string) count($squareIds),
            ],
        ]);

        redirect_to($session->url);
    }

    if ($method === 'GET' && preg_match('#^/go/(\d+)$#', $path, $matches)) {
        $squareId = validate_square_id(((int) $matches[1]) - 1);
        $square = claimed_square($squareId);

        if (!$square) {
            throw new RuntimeException('That square has not been claimed yet.');
        }

        record_square_click($squareId);
        header('X-Robots-Tag: noindex, nofollow');
        redirect_to($square['url']);
    }

    if ($method === 'GET' && $path === '/success') {
        $sessionId = (string) ($_GET['session_id'] ?? '');

        if ($sessionId === '') {
            http_response_code(404);
            header('X-Robots-Tag: noindex, follow');
            render('error', ['message' => 'That checkout confirmation does not exist.']);
        }

        if ($sessionId !== '') {
            configure_stripe();
            $session = \Stripe\Checkout\Session::retrieve($sessionId);

            if (($session->payment_status ?? null) === 'paid') {
                $squareIds = isset($session->metadata->square_ids)
                    ? array_map('intval', explode(',', (string) $session->metadata->square_ids))
                    : [(int) $session->client_reference_id];
                mark_squares_paid($squareIds, $session->id, is_string($session->payment_intent) ? $session->payment_intent : null);
            }
        }

        header('X-Robots-Tag: noindex, follow');
        render('success', ['paidSquares' => paid_squares()]);
    }

    if ($method === 'POST' && $path === '/stripe/webhook') {
        configure_stripe();

        $payload = file_get_contents('php://input') ?: '';
        $signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
        $secret = env_value('STRIPE_WEBHOOK_SECRET');

        if (!$secret || str_contains($secret, 'replace_me')) {
            throw new RuntimeException('Set STRIPE_WEBHOOK_SECRET in .env before accepting webhooks.');
        }

        $event = \Stripe\Webhook::constructEvent($payload, $signature, $secret);

        if ($event->type === 'checkout.session.completed') {
            $session = $event->data->object;

            if (($session->payment_status ?? null) === 'paid') {
                $squareIds = isset($session->metadata->square_ids)
                    ? array_map('intval', explode(',', (string) $session->metadata->square_ids))
                    : [(int) $session->client_reference_id];
                mark_squares_paid($squareIds, $session->id, is_string($session->payment_intent) ? $session->payment_intent : null);
            }
        }

        json_response(['received' => true]);
    }

    http_response_code(404);
    header('X-Robots-Tag: noindex, follow');
    render('error', ['message' => 'Page not found.']);
} catch (Throwable $e) {
    if ($path === '/api/squares' || $path === '/stripe/webhook') {
        json_response(['error' => $e->getMessage()], 400);
    }

    http_response_code(500);
    header('X-Robots-Tag: noindex, follow');
    render('error', ['message' => $e->getMessage()]);
}
