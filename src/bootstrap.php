<?php

declare(strict_types=1);

use Stripe\Stripe;

require __DIR__ . '/../vendor/autoload.php';

const TOTAL_SQUARES = 1000000;
const GRID_WIDTH = 1000;
const STRIPE_API_VERSION = '2026-02-25.clover';

function load_env(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function env_value(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    return $value === false ? $default : $value;
}

function app_url(string $path = ''): string
{
    $base = rtrim(env_value('APP_URL', 'https://linkforadollar.com'), '/');

    return $base . '/' . ltrim($path, '/');
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $storage = __DIR__ . '/../storage';
    if (!is_dir($storage)) {
        mkdir($storage, 0775, true);
    }

    $pdo = new PDO('sqlite:' . $storage . '/app.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS squares (
            square_id INTEGER PRIMARY KEY,
            label TEXT NOT NULL,
            url TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT "Other",
            click_count INTEGER NOT NULL DEFAULT 0,
            owner_email TEXT,
            checkout_session_id TEXT UNIQUE,
            payment_intent_id TEXT,
            status TEXT NOT NULL DEFAULT "pending",
            created_at TEXT NOT NULL,
            paid_at TEXT
        )'
    );
    ensure_square_columns($pdo);
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_status ON squares(status)');

    return $pdo;
}

function ensure_square_columns(PDO $pdo): void
{
    $columns = [];
    foreach ($pdo->query('PRAGMA table_info(squares)')->fetchAll(PDO::FETCH_ASSOC) as $column) {
        $columns[$column['name']] = true;
    }

    if (!isset($columns['category'])) {
        $pdo->exec('ALTER TABLE squares ADD COLUMN category TEXT NOT NULL DEFAULT "Other"');
    }

    if (!isset($columns['click_count'])) {
        $pdo->exec('ALTER TABLE squares ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0');
    }
}

function configure_stripe(): void
{
    $secret = env_value('STRIPE_SECRET_KEY');

    if (!$secret || str_contains($secret, 'replace_me')) {
        throw new RuntimeException('Set STRIPE_SECRET_KEY in .env before creating a checkout session.');
    }

    Stripe::setApiKey($secret);
    Stripe::setApiVersion(STRIPE_API_VERSION);
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function redirect_to(string $url): never
{
    header('Location: ' . $url, true, 303);
    exit;
}

function render(string $view, array $data = []): never
{
    extract($data, EXTR_SKIP);
    require __DIR__ . '/../views/' . $view . '.php';
    exit;
}

function paid_squares(): array
{
    $stmt = db()->query(
        'SELECT square_id, label, url, category, click_count, paid_at
            FROM squares
            WHERE status = "paid"
            ORDER BY square_id ASC'
    );

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function validate_square_id(mixed $value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 0, 'max_range' => TOTAL_SQUARES - 1],
    ]);

    if ($id === false) {
        throw new InvalidArgumentException('Choose a square between 1 and 1,000,000.');
    }

    return $id;
}

function normalize_url(string $url): string
{
    $url = trim($url);

    if ($url !== '' && !preg_match('/^https?:\/\//i', $url)) {
        $url = 'https://' . $url;
    }

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        throw new InvalidArgumentException('Enter a valid URL.');
    }

    return $url;
}

function normalize_label(string $label): string
{
    $label = trim($label);

    if ($label === '') {
        throw new InvalidArgumentException('Enter a label for the link.');
    }

    return mb_substr($label, 0, 80);
}

function normalize_category(string $category): string
{
    $allowed = ['AI', 'SaaS', 'Ecommerce', 'Agency', 'Media', 'Developer tools', 'Finance', 'Local business', 'Other'];
    $value = trim($category);

    return in_array($value, $allowed, true) ? $value : 'Other';
}

function reserve_square(int $squareId, string $label, string $url, string $category, ?string $email): void
{
    $stmt = db()->prepare('SELECT status FROM squares WHERE square_id = :square_id');
    $stmt->execute(['square_id' => $squareId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing && $existing['status'] === 'paid') {
        throw new RuntimeException('That square has already been claimed.');
    }

    $stmt = db()->prepare(
        'INSERT INTO squares (square_id, label, url, category, owner_email, status, created_at)
            VALUES (:square_id, :label, :url, :category, :owner_email, "pending", :created_at)
        ON CONFLICT(square_id) DO UPDATE SET
            label = excluded.label,
            url = excluded.url,
            category = excluded.category,
            owner_email = excluded.owner_email,
            status = "pending",
            created_at = excluded.created_at'
    );
    $stmt->execute([
        'square_id' => $squareId,
        'label' => $label,
        'url' => $url,
        'category' => $category,
        'owner_email' => $email ?: null,
        'created_at' => gmdate(DATE_ATOM),
    ]);
}

function mark_square_paid(int $squareId, string $checkoutSessionId, ?string $paymentIntentId): void
{
    $stmt = db()->prepare(
        'UPDATE squares
            SET status = "paid",
                checkout_session_id = :checkout_session_id,
                payment_intent_id = :payment_intent_id,
                paid_at = COALESCE(paid_at, :paid_at)
            WHERE square_id = :square_id'
    );
    $stmt->execute([
        'square_id' => $squareId,
        'checkout_session_id' => $checkoutSessionId,
        'payment_intent_id' => $paymentIntentId,
        'paid_at' => gmdate(DATE_ATOM),
    ]);
}

function claimed_square(int $squareId): ?array
{
    $stmt = db()->prepare('SELECT square_id, url FROM squares WHERE square_id = :square_id AND status = "paid"');
    $stmt->execute(['square_id' => $squareId]);
    $square = $stmt->fetch(PDO::FETCH_ASSOC);

    return $square ?: null;
}

function record_square_click(int $squareId): void
{
    $stmt = db()->prepare('UPDATE squares SET click_count = click_count + 1 WHERE square_id = :square_id AND status = "paid"');
    $stmt->execute(['square_id' => $squareId]);
}

load_env(__DIR__ . '/../.env');
