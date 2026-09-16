<?php
/**
 * Create or update a super admin in the E-Qarza SQLite database.
 *
 * The app stores passwords as a plain SHA-256 hex digest (see src/lib/auth.ts),
 * NOT bcrypt. This script must use the same scheme or the login will fail.
 *
 * Usage:
 *   CLI:    php create-admin.php <username> <password>
 *   Web:    GET/POST /create-admin.php?username=admin&password=secret&key=YOUR_KEY
 *
 * For web use a key is required and must match the ADMIN_CREATE_KEY constant
 * below (or the ADMIN_CREATE_KEY environment variable). Delete this file after
 * creating the admin.
 */

declare(strict_types=1);

const ADMIN_CREATE_KEY = 'CHANGE-ME-TO-A-LONG-SECRET';

function fail(int $code, string $msg): void {
    $isCli = (PHP_SAPI === 'cli');
    if ($isCli) {
        fwrite(STDERR, "Error: $msg\n");
    } else {
        http_response_code($code);
        echo "Error: $msg\n";
    }
    exit(1);
}

// SQLite database path. Resolved from the DATABASE_URL env var ("file:./prisma/db/custom.db");
// falls back to known locations relative to this script so it works from the
// repo root and inside the app/ directory.
$candidates = [];

$dbUrl = getenv('DATABASE_URL');
if ($dbUrl !== false) {
    $rel = preg_replace('/^file:/', '', trim($dbUrl));
    if ($rel !== '' && $rel[0] !== '/' && !preg_match('/^[A-Za-z]:[\\\\\/]/', $rel)) {
        $candidates[] = __DIR__ . DIRECTORY_SEPARATOR . $rel;
        $candidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . ltrim($rel, './');
    } else {
        $candidates[] = $rel;
    }
}
$candidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'prisma' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'custom.db';
$candidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'prisma' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'custom.db';

$dbPath = '';
foreach (array_unique($candidates) as $cand) {
    if (is_file($cand)) {
        $dbPath = $cand;
        break;
    }
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
$isCli = (PHP_SAPI === 'cli');

if ($isCli) {
    $username = $argv[1] ?? '';
    $password = $argv[2] ?? '';
    if ($username === '' || $password === '') {
        fwrite(STDERR, "Usage: php create-admin.php <username> <password>\n");
        exit(2);
    }
} else {
    header('Content-Type: text/plain; charset=utf-8');
    $key = $_GET['key'] ?? $_POST['key'] ?? '';
    $envKey = getenv('ADMIN_CREATE_KEY') ?: ADMIN_CREATE_KEY;
    if ($key === '' || !hash_equals($envKey, $key)) {
        http_response_code(403);
        echo "Forbidden: invalid or missing key.\n";
        exit;
    }
    $username = trim((string)($_GET['username'] ?? $_POST['username'] ?? ''));
    $password = (string)($_GET['password'] ?? $_POST['password'] ?? '');
    if ($username === '' || $password === '') {
        http_response_code(400);
        echo "Missing username or password.\n";
        exit;
    }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
if (!extension_loaded('pdo_sqlite')) {
    fail(500, 'pdo_sqlite extension is not enabled');
}

if (!is_file($dbPath)) {
    fail(500, "database not found at $dbPath");
}

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    fail(500, 'cannot open database: ' . $e->getMessage());
}

// ---------------------------------------------------------------------------
// Create / update the admin
// ---------------------------------------------------------------------------
$passwordHash = hash('sha256', $password);   // matches src/lib/auth.ts hashPassword()
$id = 'c' . substr(hash('sha256', uniqid((string)mt_rand(), true)), 0, 24);

$stmt = $pdo->prepare('SELECT id FROM Admin WHERE username = :username');
$stmt->execute([':username' => $username]);
$existing = $stmt->fetch(PDO::FETCH_ASSOC);

if ($existing) {
    $update = $pdo->prepare('UPDATE Admin SET passwordHash = :hash WHERE id = :id');
    $update->execute([':hash' => $passwordHash, ':id' => $existing['id']]);
    $action = "updated";
} else {
    $insert = $pdo->prepare(
        'INSERT INTO Admin (id, username, passwordHash, createdAt) VALUES (:id, :username, :hash, :createdAt)'
    );
    $insert->execute([
        ':id'        => $id,
        ':username'  => $username,
        ':hash'      => $passwordHash,
        ':createdAt' => date('Y-m-d H:i:s'),
    ]);
    $action = "created";
}

$message = "Super admin \"$username\" $action successfully.\nDatabase: $dbPath\n";
if ($isCli) {
    echo $message;
} else {
    echo $message;
}