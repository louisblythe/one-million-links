<?php

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET' && $path === '/') {
        render('home', [
            'paidSquares' => paid_squares(),
            'selectedSquare' => isset($_GET['square']) ? max(1, min(TOTAL_SQUARES, (int) $_GET['square'])) : 1,
        ]);
    }

    if ($method === 'GET' && $path === '/api/squares') {
        json_response(['squares' => paid_squares()]);
    }

    if ($method === 'POST' && $path === '/checkout') {
        $squareId = validate_square_id(((int) ($_POST['square_id'] ?? 1)) - 1);
        $label = normalize_label((string) ($_POST['label'] ?? ''));
        $url = normalize_url((string) ($_POST['url'] ?? ''));
        $category = normalize_category((string) ($_POST['category'] ?? 'Other'));
        $email = trim((string) ($_POST['email'] ?? ''));
        $email = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;

        reserve_square($squareId, $label, $url, $category, $email);
        configure_stripe();

        $session = \Stripe\Checkout\Session::create([
            'mode' => 'payment',
            'client_reference_id' => (string) $squareId,
            'customer_email' => $email,
            'success_url' => app_url('/success?session_id={CHECKOUT_SESSION_ID}'),
            'cancel_url' => app_url('/?square=' . ($squareId + 1) . '&cancelled=1'),
            'line_items' => [[
                'quantity' => 1,
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
        redirect_to($square['url']);
    }

    if ($method === 'GET' && $path === '/success') {
        $sessionId = (string) ($_GET['session_id'] ?? '');

        if ($sessionId !== '') {
            configure_stripe();
            $session = \Stripe\Checkout\Session::retrieve($sessionId);

            if (($session->payment_status ?? null) === 'paid') {
                mark_square_paid((int) $session->client_reference_id, $session->id, is_string($session->payment_intent) ? $session->payment_intent : null);
            }
        }

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
                mark_square_paid((int) $session->client_reference_id, $session->id, is_string($session->payment_intent) ? $session->payment_intent : null);
            }
        }

        json_response(['received' => true]);
    }

    http_response_code(404);
    render('error', ['message' => 'Page not found.']);
} catch (Throwable $e) {
    if ($path === '/api/squares' || $path === '/stripe/webhook') {
        json_response(['error' => $e->getMessage()], 400);
    }

    http_response_code(400);
    render('error', ['message' => $e->getMessage()]);
}
