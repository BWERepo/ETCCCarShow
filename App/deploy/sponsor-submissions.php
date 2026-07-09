<?php
// Password-protected read API for sponsor-submissions.json (contains PII) —
// called by the offline app's Sponsors tab "Import from Server" button
// (App/src/app.js). This is deliberately NOT session-cookie based like
// index.php: the caller is usually ETCCCarShow.html running from a file://
// URL or a different origin entirely, so there's no shared session to rely
// on. Instead every request must include the site password, checked against
// the same secrets.php hash index.php uses.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

header('Content-Type: application/json');
require __DIR__ . '/secrets.php';

$input = json_decode(file_get_contents('php://input'), true);
$pw = (string)($input['password'] ?? ($_POST['password'] ?? ''));

if ($pw === '' || !hash_equals($PASSWORD_HASH, crypt($pw, $PASSWORD_HASH))) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$file = __DIR__ . '/sponsor-submissions.json';
$list = [];
if (is_file($file)) {
    $raw = file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : [];
    if (is_array($decoded)) $list = $decoded;
}
echo json_encode(['ok' => true, 'sponsors' => $list]);
