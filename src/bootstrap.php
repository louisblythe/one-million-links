<?php

declare(strict_types=1);

use Stripe\StripeClient;

require __DIR__ . '/../vendor/autoload.php';

const TOTAL_SQUARES = 1000000;
const GRID_WIDTH = 1000;
const STRIPE_API_VERSION = '2026-07-29.dahlia';
const DATAFAST_WEBSITE_ID = 'dfid_covNyYU25Nl5a20HXqsd3';
const DATAFAST_DOMAIN = 'linkforadollar.com';

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
            owner_host TEXT,
            category TEXT NOT NULL DEFAULT "Other",
            click_count INTEGER NOT NULL DEFAULT 0,
            owner_email TEXT,
            checkout_session_id TEXT UNIQUE,
            payment_intent_id TEXT,
            verified_company INTEGER NOT NULL DEFAULT 0,
            territory_key TEXT,
            territory_size INTEGER NOT NULL DEFAULT 1,
            featured_from TEXT,
            featured_until TEXT,
            featured_amount_cents INTEGER,
            purchase_city TEXT,
            purchase_country TEXT,
            purchase_latitude REAL,
            purchase_longitude REAL,
            location_source TEXT,
            logo_url TEXT,
            status TEXT NOT NULL DEFAULT "pending",
            created_at TEXT NOT NULL,
            paid_at TEXT
        )'
    );
    ensure_square_columns($pdo);
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_status ON squares(status)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_territory ON squares(territory_key)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_owner_host ON squares(owner_host)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_featured_until ON squares(featured_until)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_featured_amount ON squares(featured_amount_cents)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_squares_purchase_country ON squares(purchase_country)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS visitor_presence (session_id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen ON visitor_presence(last_seen)');

    return $pdo;
}

function ensure_square_columns(PDO $pdo): void
{
    $columns = [];
    foreach ($pdo->query('PRAGMA table_info(squares)')->fetchAll(PDO::FETCH_ASSOC) as $column) {
        $columns[$column['name']] = true;
    }

    $definitions = [
        'owner_host' => 'TEXT',
        'category' => 'TEXT NOT NULL DEFAULT "Other"',
        'click_count' => 'INTEGER NOT NULL DEFAULT 0',
        'verified_company' => 'INTEGER NOT NULL DEFAULT 0',
        'territory_key' => 'TEXT',
        'territory_size' => 'INTEGER NOT NULL DEFAULT 1',
        'featured_from' => 'TEXT',
        'featured_until' => 'TEXT',
        'featured_amount_cents' => 'INTEGER',
        'purchase_city' => 'TEXT',
        'purchase_country' => 'TEXT',
        'purchase_latitude' => 'REAL',
        'purchase_longitude' => 'REAL',
        'location_source' => 'TEXT',
        'logo_url' => 'TEXT',
    ];

    foreach ($definitions as $name => $definition) {
        if (!isset($columns[$name])) {
            $pdo->exec(sprintf('ALTER TABLE squares ADD COLUMN %s %s', $name, $definition));
        }
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS featured_payments (checkout_session_id TEXT PRIMARY KEY, square_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL, total_bid_cents INTEGER NOT NULL, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_featured_payments_square ON featured_payments(square_id)');
}

function configure_stripe(): StripeClient
{
    $secret = env_value('STRIPE_SECRET_KEY');

    if (!$secret || str_contains($secret, 'replace_me')) {
        throw new RuntimeException('Set STRIPE_SECRET_KEY in .env before creating a checkout session.');
    }

    return new StripeClient([
        'api_key' => $secret,
        'stripe_version' => STRIPE_API_VERSION,
    ]);
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function redirect_to(string $url, int $status = 303): never
{
    header('Location: ' . $url, true, $status);
    exit;
}

function datafast_analytics_script(): string
{
    return '<script defer data-website-id="' . DATAFAST_WEBSITE_ID . '" data-domain="' . DATAFAST_DOMAIN . '" src="https://datafa.st/js/script.js"></script>' . PHP_EOL;
}

function seo_head(string $title, string $description, ?string $path = '/', string $robots = 'index, follow, max-image-preview:large'): string
{
    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    $canonical = $path !== null ? app_url($path) : null;
    $image = app_url('/og-image.png');

    return '<title>' . $escape($title) . '</title>' . PHP_EOL
        . '<meta name="description" content="' . $escape($description) . '">' . PHP_EOL
        . '<meta name="robots" content="' . $escape($robots) . '">' . PHP_EOL
        . ($canonical ? '<link rel="canonical" href="' . $escape($canonical) . '">' . PHP_EOL : '')
        . '<meta property="og:type" content="website">' . PHP_EOL
        . '<meta property="og:site_name" content="Link for a Dollar">' . PHP_EOL
        . '<meta property="og:title" content="' . $escape($title) . '">' . PHP_EOL
        . '<meta property="og:description" content="' . $escape($description) . '">' . PHP_EOL
        . ($canonical ? '<meta property="og:url" content="' . $escape($canonical) . '">' . PHP_EOL : '')
        . '<meta property="og:image" content="' . $escape($image) . '">' . PHP_EOL
        . '<meta property="og:image:type" content="image/png">' . PHP_EOL
        . '<meta property="og:image:width" content="1200">' . PHP_EOL
        . '<meta property="og:image:height" content="630">' . PHP_EOL
        . '<meta property="og:image:alt" content="' . $escape($title) . '">' . PHP_EOL
        . '<meta name="twitter:card" content="summary_large_image">' . PHP_EOL
        . '<meta name="twitter:title" content="' . $escape($title) . '">' . PHP_EOL
        . '<meta name="twitter:description" content="' . $escape($description) . '">' . PHP_EOL
        . '<meta name="twitter:image" content="' . $escape($image) . '">' . PHP_EOL
        . '<meta name="twitter:image:alt" content="' . $escape($title) . '">' . PHP_EOL
        . '<meta name="theme-color" content="#0b6bcb">' . PHP_EOL
        . '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' . PHP_EOL
        . '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' . PHP_EOL
        . '<link rel="manifest" href="/site.webmanifest">' . PHP_EOL
        . '<link rel="stylesheet" href="/assets/app.css?v=20260822-checkout">' . PHP_EOL
        . datafast_analytics_script();
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
        'SELECT square_id, label, description, url, category, click_count, verified_company, territory_key, territory_size, featured_from, featured_until, featured_amount_cents, purchase_city, purchase_country, purchase_latitude, purchase_longitude, location_source, logo_url, paid_at
            FROM squares
            WHERE status = "paid"
            ORDER BY square_id ASC'
    );

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function host_from_url(string $url): string
{
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));

    return preg_replace('/^www\./', '', $host) ?: 'unknown';
}

function profile_slug(string $url): string
{
    return rawurlencode(host_from_url($url));
}

function profile_for_host(string $host): ?array
{
    $host = strtolower(trim($host));
    $squares = array_values(array_filter(paid_squares(), fn (array $square): bool => host_from_url($square['url']) === $host));

    if (!$squares) {
        return null;
    }

    $first = $squares[0];
    $territories = [];
    $clicks = 0;
    foreach ($squares as $square) {
        $territories[$square['territory_key'] ?: (string) $square['square_id']] = true;
        $clicks += (int) $square['click_count'];
    }

    return [
        'host' => $host,
        'label' => $first['label'],
        'description' => $first['description'] ?? '',
        'url' => $first['url'],
        'category' => $first['category'],
        'verified_company' => (bool) $first['verified_company'],
        'squares' => $squares,
        'square_count' => count($squares),
        'territory_count' => count($territories),
        'click_count' => $clicks,
    ];
}

function stats_page_data(): array
{
    $squares = paid_squares();
    $owners = [];
    $territories = [];
    $totalClicks = 0;

    foreach ($squares as $square) {
        $host = host_from_url($square['url']);
        $territoryKey = $square['territory_key'] ?: 'single:' . $square['square_id'];
        $clicks = (int) ($square['click_count'] ?? 0);
        $totalClicks += $clicks;
        $territories[$territoryKey] = true;

        if (!isset($owners[$host])) {
            $owners[$host] = [
                'host' => $host,
                'label' => $square['label'],
                'url' => $square['url'],
                'category' => $square['category'],
                'square_count' => 0,
                'territories' => [],
                'click_count' => 0,
                'first_square' => (int) $square['square_id'] + 1,
            ];
        }

        $owners[$host]['square_count']++;
        $owners[$host]['territories'][$territoryKey] = true;
        $owners[$host]['click_count'] += $clicks;
        $owners[$host]['first_square'] = min($owners[$host]['first_square'], (int) $square['square_id'] + 1);
    }

    $ownerRows = array_map(static function (array $owner): array {
        $owner['territory_count'] = count($owner['territories']);
        unset($owner['territories']);
        return $owner;
    }, array_values($owners));

    $topPerforming = $squares;
    usort($topPerforming, static fn (array $a, array $b): int => ((int) $b['click_count'] <=> (int) $a['click_count']) ?: ((int) $a['square_id'] <=> (int) $b['square_id']));

    $largestOwners = $ownerRows;
    usort($largestOwners, static fn (array $a, array $b): int => ($b['square_count'] <=> $a['square_count']) ?: ($b['click_count'] <=> $a['click_count']));

    $recent = $squares;
    usort($recent, static fn (array $a, array $b): int => strcmp((string) ($b['paid_at'] ?? ''), (string) ($a['paid_at'] ?? '')) ?: ((int) $b['square_id'] <=> (int) $a['square_id']));

    $founding = $squares;
    usort($founding, static fn (array $a, array $b): int => strcmp((string) ($a['paid_at'] ?? ''), (string) ($b['paid_at'] ?? '')) ?: ((int) $a['square_id'] <=> (int) $b['square_id']));

    $categories = [];
    foreach ($squares as $square) {
        $category = $square['category'] ?: 'Other';
        $categories[$category] ??= ['category' => $category, 'square_count' => 0, 'click_count' => 0];
        $categories[$category]['square_count']++;
        $categories[$category]['click_count'] += (int) ($square['click_count'] ?? 0);
    }
    $categoryRows = array_values($categories);
    usort($categoryRows, static fn (array $a, array $b): int => ($b['square_count'] <=> $a['square_count']) ?: ($b['click_count'] <=> $a['click_count']));

    return [
        'summary' => [
            'claimed' => count($squares),
            'owners' => count($owners),
            'territories' => count($territories),
            'clicks' => $totalClicks,
        ],
        'topPerforming' => array_slice($topPerforming, 0, 12),
        'largestOwners' => array_slice($largestOwners, 0, 12),
        'recent' => array_slice($recent, 0, 12),
        'founding' => array_slice($founding, 0, 12),
        'categories' => array_slice($categoryRows, 0, 12),
    ];
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

function normalize_description(string $description): string
{
    return mb_substr(trim($description), 0, 180);
}

function normalize_category(string $category): string
{
    $allowed = ['AI', 'SaaS', 'Ecommerce', 'Agency', 'Media', 'Developer tools', 'Finance', 'Local business', 'Other'];
    $value = trim($category);

    return in_array($value, $allowed, true) ? $value : 'Other';
}

function category_from_path(string $value): ?string
{
    $allowed = ['AI', 'SaaS', 'Ecommerce', 'Agency', 'Media', 'Developer tools', 'Finance', 'Local business', 'Other'];
    $normalized = strtolower(preg_replace('/\s+/', ' ', str_replace('-', ' ', trim($value))) ?: '');

    foreach ($allowed as $category) {
        if (strtolower($category) === $normalized) {
            return $category;
        }
    }

    return null;
}

function normalize_pack_size(mixed $value): int
{
    $size = filter_var($value, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 25],
    ]);
    $allowed = [1, 4, 10, 25];

    return in_array($size, $allowed, true) ? $size : 1;
}

function normalize_payment_level(mixed $value, int $minimum): int
{
    $level = filter_var($value, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => $minimum, 'max_range' => 10000],
    ]);

    if ($level === false) {
        throw new RuntimeException(sprintf('Choose a whole-dollar payment level between $%d and $10,000.', $minimum));
    }

    return $level;
}

function random_letters(int $length): string
{
    $alphabet = 'abcdefghijklmnopqrstuvwxyz';
    $bytes = random_bytes($length);
    $result = '';

    for ($index = 0; $index < $length; $index += 1) {
        $result .= $alphabet[ord($bytes[$index]) % strlen($alphabet)];
    }

    return $result;
}

function company_is_verified(string $url, ?string $email): bool
{
    if (!$email) {
        return false;
    }

    $emailDomain = strtolower(substr(strrchr($email, '@') ?: '', 1));
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));
    $host = preg_replace('/^www\./', '', $host);

    return $emailDomain !== '' && ($host === $emailDomain || str_ends_with($host, '.' . $emailDomain));
}

function adjacent_square_ids(int $squareId, int $packSize): array
{
    $width = $packSize === 1 ? 1 : (int) ceil(sqrt($packSize));
    $height = (int) ceil($packSize / $width);
    $startX = min($squareId % GRID_WIDTH, GRID_WIDTH - $width);
    $startY = min(intdiv($squareId, GRID_WIDTH), GRID_WIDTH - $height);
    $ids = [];

    for ($y = 0; $y < $height && count($ids) < $packSize; $y += 1) {
        for ($x = 0; $x < $width && count($ids) < $packSize; $x += 1) {
            $ids[] = ($startY + $y) * GRID_WIDTH + $startX + $x;
        }
    }

    return $ids;
}

function rebid_context(string $url): array
{
    $db = db();
    $existing = $db->prepare('SELECT square_id, territory_key, featured_amount_cents FROM squares WHERE status = "paid" AND url = :url ORDER BY featured_amount_cents DESC, square_id ASC LIMIT 1');
    $existing->execute(['url' => $url]);
    $primary = $existing->fetch(PDO::FETCH_ASSOC) ?: null;
    $highestQuery = $db->prepare('SELECT COALESCE(MAX(featured_amount_cents), 0) FROM squares WHERE status = "paid" AND featured_until > :now');
    $highestQuery->execute(['now' => gmdate(DATE_ATOM)]);
    $highest = (int) $highestQuery->fetchColumn();

    if (!$primary) {
        return ['square_ids' => [], 'previous_cents' => 0, 'highest_cents' => $highest];
    }

    if (!empty($primary['territory_key'])) {
        $territory = $db->prepare('SELECT square_id FROM squares WHERE status = "paid" AND territory_key = :territory_key ORDER BY square_id ASC');
        $territory->execute(['territory_key' => $primary['territory_key']]);
        $squareIds = array_map('intval', $territory->fetchAll(PDO::FETCH_COLUMN));
    } else {
        $squareIds = [(int) $primary['square_id']];
    }

    return ['square_ids' => $squareIds, 'previous_cents' => (int) ($primary['featured_amount_cents'] ?? 0), 'highest_cents' => $highest];
}

function reserve_squares(int $squareId, int $packSize, string $label, string $description, string $url, string $category, ?string $email, ?string $logoUrl = null): array
{
    $ids = adjacent_square_ids($squareId, $packSize);
    $db = db();
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("SELECT square_id FROM squares WHERE status = 'paid' AND square_id IN ($placeholders)");
    $stmt->execute($ids);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        throw new RuntimeException('That listing position is no longer available.');
    }

    $territoryKey = bin2hex(random_bytes(8));
    $verified = company_is_verified($url, $email) ? 1 : 0;
    $ownerHost = host_from_url($url);
    $stmt = $db->prepare(
        'INSERT INTO squares (square_id, label, description, url, owner_host, category, owner_email, verified_company, territory_key, territory_size, logo_url, status, created_at)
            VALUES (:square_id, :label, :description, :url, :owner_host, :category, :owner_email, :verified_company, :territory_key, :territory_size, :logo_url, "pending", :created_at)
        ON CONFLICT(square_id) DO UPDATE SET
            label = excluded.label,
            description = excluded.description,
            url = excluded.url,
            owner_host = excluded.owner_host,
            category = excluded.category,
            owner_email = excluded.owner_email,
            verified_company = excluded.verified_company,
            territory_key = excluded.territory_key,
            territory_size = excluded.territory_size,
            logo_url = excluded.logo_url,
            status = "pending",
            created_at = excluded.created_at'
    );
    $createdAt = gmdate(DATE_ATOM);

    foreach ($ids as $id) {
        $stmt->execute([
            'square_id' => $id,
            'label' => $label,
            'description' => $description ?: null,
            'url' => $url,
            'owner_host' => $ownerHost,
            'category' => $category,
            'owner_email' => $email ?: null,
            'verified_company' => $verified,
            'territory_key' => $territoryKey,
            'territory_size' => count($ids),
            'logo_url' => $logoUrl,
            'created_at' => $createdAt,
        ]);
    }

    return $ids;
}

function reserve_next_listing(string $label, string $description, string $url, string $category, ?string $email, ?string $logoUrl = null): int
{
    $stmt = db()->query('WITH RECURSIVE candidate(square_id) AS (SELECT 0 UNION ALL SELECT square_id + 1 FROM candidate WHERE square_id < 999999) SELECT candidate.square_id FROM candidate LEFT JOIN squares ON squares.square_id = candidate.square_id WHERE squares.square_id IS NULL LIMIT 1');
    $squareId = $stmt->fetchColumn();

    if ($squareId === false) {
        throw new RuntimeException('The listing directory is full.');
    }

    return (int) reserve_squares((int) $squareId, 1, $label, $description, $url, $category, $email, $logoUrl)[0];
}

function release_pending_listing(int $squareId): void
{
    $stmt = db()->prepare('DELETE FROM squares WHERE square_id = :square_id AND status = "pending"');
    $stmt->execute(['square_id' => validate_square_id($squareId)]);
}

function country_location(string $country): ?array
{
    $country = substr(trim($country), 0, 80);
    if ($country === '') {
        return null;
    }
    $endpoint = 'https://nominatim.openstreetmap.org/search?country=' . rawurlencode($country) . '&format=jsonv2&limit=1&featuretype=country&addressdetails=1';
    $context = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true, 'header' => "User-Agent: LinkForADollar/1.0 (https://linkforadollar.com)\r\nAccept-Language: en\r\n"]]);
    $payload = @file_get_contents($endpoint, false, $context);
    $decoded = $payload ? json_decode($payload, true) : null;
    $result = $decoded[0] ?? null;
    $latitude = $result['lat'] ?? null;
    $longitude = $result['lon'] ?? null;
    $countryCode = strtoupper((string) ($result['address']['country_code'] ?? (preg_match('/^[a-z]{2}$/i', $country) ? $country : '')));

    if (!is_array($result) || !preg_match('/^[A-Z]{2}$/', $countryCode) || !is_numeric($latitude) || !is_numeric($longitude)) {
        throw new RuntimeException('We could not find that country. Enter its full English name or two-letter country code.');
    }

    return [
        'city' => substr((string) ($result['name'] ?? $result['display_name'] ?? $country), 0, 80),
        'country' => $countryCode,
        'latitude' => (float) $latitude,
        'longitude' => (float) $longitude,
        'source' => 'country_centroid',
    ];
}

function reserve_square(int $squareId, string $label, string $url, string $category, ?string $email): void
{
    reserve_squares($squareId, 1, $label, '', $url, $category, $email);
}

function stripe_purchase_location(object $session): ?array
{
    $latitude = filter_var($session->metadata->purchase_latitude ?? null, FILTER_VALIDATE_FLOAT);
    $longitude = filter_var($session->metadata->purchase_longitude ?? null, FILTER_VALIDATE_FLOAT);

    if ($latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        return null;
    }

    return [
        'city' => substr((string) ($session->metadata->purchase_city ?? ''), 0, 80),
        'country' => substr(strtoupper((string) ($session->metadata->purchase_country ?? '')), 0, 2),
        'latitude' => $latitude,
        'longitude' => $longitude,
        'source' => substr((string) ($session->metadata->location_source ?? 'checkout'), 0, 40),
    ];
}

function stripe_logo_url(object $session): ?string
{
    $value = trim((string) ($session->metadata->logo_url ?? ''));
    return $value !== '' && filter_var($value, FILTER_VALIDATE_URL) ? substr($value, 0, 500) : null;
}

function mark_squares_paid(array $squareIds, string $checkoutSessionId, ?string $paymentIntentId, int $featuredDays = 0, int $totalBidCents = 0, ?array $purchaseLocation = null, ?string $logoUrl = null): void
{
    $db = db();
    $stmt = $db->prepare(
        'UPDATE squares
            SET status = "paid",
                checkout_session_id = :checkout_session_id,
                payment_intent_id = :payment_intent_id,
                paid_at = COALESCE(paid_at, :paid_at)
            WHERE square_id = :square_id'
    );
    $paidAt = gmdate(DATE_ATOM);

    $db->beginTransaction();

    try {
        foreach ($squareIds as $squareId) {
            $storedCheckoutSessionId = count($squareIds) > 1 ? $checkoutSessionId . ':' . $squareId : $checkoutSessionId;
            $stmt->execute([
                'square_id' => validate_square_id($squareId),
                'checkout_session_id' => $storedCheckoutSessionId,
                'payment_intent_id' => $paymentIntentId,
                'paid_at' => $paidAt,
            ]);
        }

        if ($logoUrl !== null && $squareIds !== []) {
            $logo = $db->prepare('UPDATE squares SET logo_url = :logo_url WHERE square_id = :square_id');
            $logo->execute(['logo_url' => $logoUrl, 'square_id' => validate_square_id((int) $squareIds[0])]);
        }

        if ($purchaseLocation !== null && $squareIds !== []) {
            $location = $db->prepare('UPDATE squares SET purchase_city = :city, purchase_country = :country, purchase_latitude = :latitude, purchase_longitude = :longitude, location_source = :source WHERE square_id = :square_id');
            $location->execute([
                'city' => $purchaseLocation['city'],
                'country' => $purchaseLocation['country'],
                'latitude' => $purchaseLocation['latitude'],
                'longitude' => $purchaseLocation['longitude'],
                'source' => $purchaseLocation['source'] ?? 'country_centroid',
                'square_id' => validate_square_id((int) $squareIds[0]),
            ]);
        }

        if ($featuredDays > 0 && $squareIds !== []) {
            $primaryId = validate_square_id((int) $squareIds[0]);
            $payment = $db->prepare('INSERT OR IGNORE INTO featured_payments (checkout_session_id, square_id, amount_cents, total_bid_cents, created_at) VALUES (:checkout_session_id, :square_id, :amount_cents, :total_bid_cents, :created_at)');
            $payment->execute([
                'checkout_session_id' => $checkoutSessionId,
                'square_id' => $primaryId,
                'amount_cents' => $featuredDays * 100,
                'total_bid_cents' => $totalBidCents,
                'created_at' => $paidAt,
            ]);
            $isNewPayment = $payment->rowCount() > 0;
            $existing = $db->prepare('SELECT featured_until FROM squares WHERE square_id = :square_id');
            $existing->execute(['square_id' => $primaryId]);
            $existingFeature = $existing->fetch(PDO::FETCH_ASSOC) ?: [];

            if ($isNewPayment) {
                $now = new DateTimeImmutable($paidAt);
                $existingUntil = !empty($existingFeature['featured_until']) ? new DateTimeImmutable((string) $existingFeature['featured_until']) : $now;
                $extensionBase = $existingUntil > $now ? $existingUntil : $now;
                $endsAt = $extensionBase->modify(sprintf('+%d days', $featuredDays));
                $feature = $db->prepare(
                    'UPDATE squares SET featured_from = :featured_from, featured_until = :featured_until, featured_amount_cents = MAX(COALESCE(featured_amount_cents, 0), :featured_amount_cents) WHERE square_id = :square_id'
                );
                $feature->execute([
                    'featured_from' => $now->format(DATE_ATOM),
                    'featured_until' => $endsAt->format(DATE_ATOM),
                    'featured_amount_cents' => max($totalBidCents, $featuredDays * 100),
                    'square_id' => $primaryId,
                ]);
            }
        }

        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function mark_square_paid(int $squareId, string $checkoutSessionId, ?string $paymentIntentId): void
{
    mark_squares_paid([$squareId], $checkoutSessionId, $paymentIntentId);
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

function record_presence(string $sessionId): array
{
    if (!preg_match('/^[a-f0-9-]{36}$/i', $sessionId)) {
        throw new InvalidArgumentException('A valid presence session is required.');
    }

    $database = db();
    $now = gmdate('Y-m-d H:i:s');
    $statement = $database->prepare('INSERT INTO visitor_presence (session_id, first_seen, last_seen) VALUES (:session_id, :first_seen, :last_seen) ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen');
    $statement->execute(['session_id' => $sessionId, 'first_seen' => $now, 'last_seen' => $now]);
    $database->exec("DELETE FROM visitor_presence WHERE last_seen < datetime('now', '-2 days')");
    $stats = $database->query("SELECT SUM(CASE WHEN last_seen >= datetime('now', '-5 minutes') THEN 1 ELSE 0 END) AS active_now, SUM(CASE WHEN last_seen >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS sessions_24h FROM visitor_presence")->fetch(PDO::FETCH_ASSOC);

    return ['active_now' => (int) ($stats['active_now'] ?? 0), 'sessions_24h' => (int) ($stats['sessions_24h'] ?? 0), 'measured_at' => gmdate(DATE_ATOM)];
}

load_env(__DIR__ . '/../.env');
