<?php
// Sponsor payment read/write API for sponsor-payments.json. Records money
// received against a sponsor (Cash/Check/Credit Card, amount, date, and for
// checks a check #) — created either by the Edit Sponsor modal's payment
// section or by backfillPaymentDefaults()/backfillIndividualSponsorPayments()
// for Individual Sponsorships. index.php reads this fresh on every page load
// (window.__carshow.ingestPayments), and app.js pushes every new payment
// here immediately, same pattern as walkin-registrations.php.
//
// Actions: list (default), add.
//
// Auth via lib.php's carshow_authed() — same PHP-session-or-password dual
// check every endpoint here uses.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

header('Content-Type: application/json');
require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

if (!carshow_authed($PASSWORD_HASH, $input['password'] ?? ($_POST['password'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$file = __DIR__ . '/sponsor-payments.json';
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'payments' => carshow_read_json_list($file)]);
    exit;
}

if ($action === 'add') {
    $payment = $input['payment'] ?? null;
    if (!is_array($payment) || empty($payment['sponsorId']) || empty($payment['paymentType'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'sponsorId and paymentType are required.']);
        exit;
    }
    if (empty($payment['id'])) {
        $payment['id'] = 'pay' . str_replace('.', '', uniqid('', true));
    }
    if (!carshow_append_json_list($file, $payment)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'payment' => $payment]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
