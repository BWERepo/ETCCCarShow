<?php
session_start();

// Belt-and-suspenders against browser/proxy caching of the gate itself —
// this page's content depends on session state, so a cached copy (login
// screen after you've authenticated, or vice versa) is always wrong. Relying
// on PHP's default session cache limiter wasn't enough on this host.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// $PASSWORD_HASH is defined in secrets.php (gitignored, not committed — see
// secrets.example.php for the template). Generate a new hash with:
//   openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'
// crypt() verifies SHA-512-crypt ($6$) hashes natively, no PHP needed locally.
require __DIR__ . '/secrets.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    header('Content-Type: application/json');
    $pw = (string)($_POST['password'] ?? '');
    $ok = hash_equals($PASSWORD_HASH, crypt($pw, $PASSWORD_HASH));
    if ($ok) {
        session_regenerate_id(true);
        $_SESSION['carshow_authenticated'] = true;
        echo json_encode(['success' => true]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false]);
    }
    exit;
}

if (empty($_SESSION['carshow_authenticated'])) {
    readfile(__DIR__ . '/_login.html');
    exit;
}

header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/_data.html');
