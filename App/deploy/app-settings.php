<?php
// Small key/value settings store for app-settings.json:
//  - walkinFirstNonMember: the starting number the Registration tab's Add
//    Registration form auto-assigns to Walk-In Nonmembers (see
//    nextAvailableWalkinNumber() in app.js). Deliberately separate from
//    registrations-data.json's own CSV-derived nonmember numbering (which
//    stays hardcoded at CONFIG.firstNonMember/8001) — the two numbering
//    pools are intentionally independent, see PROJECT_STATUS.md.
//  - walkInCarShowFee / walkInNonCarShowFee: default Total Fee Collected
//    amounts the Add Registration form fills in based on its In Car Show?
//    field (Yes -> walkInCarShowFee, No -> walkInNonCarShowFee).
//  - preregistrationFee: reference value only (what a CSV-preregistered
//    attendee pays) — not applied anywhere in the UI, since preregistered
//    people come from the CSV import, not this form.
//
// Actions: get (default), save.
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

$file = __DIR__ . '/app-settings.json';
$action = (string)($input['action'] ?? 'get');
$defaults = [
    'walkinFirstNonMember' => 2000,
    'walkInCarShowFee' => 50,
    'walkInNonCarShowFee' => 0,
    'preregistrationFee' => 40
];

if ($action === 'get') {
    $raw = is_file($file) ? json_decode(file_get_contents($file), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : []);
    echo json_encode(['ok' => true, 'settings' => $settings]);
    exit;
}

if ($action === 'save') {
    $incoming = $input['settings'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing settings.']);
        exit;
    }
    $raw = is_file($file) ? json_decode(file_get_contents($file), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : [], $incoming);
    if (!carshow_write_json($file, $settings)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'settings' => $settings]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
