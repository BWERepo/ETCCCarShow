<?php
// Tracks which CSV-auto-synced sponsor rows (Individual Sponsorship activity,
// id shape "csvind_<csvRegKey>" — see csvSponsorId() in app.js) have been
// deleted from the Sponsors tab. Mirrors deleted-registrations.php exactly,
// for the same reason: a CSV-derived sponsor has no server record of its own
// to permanently delete — syncSponsorsFromRegistrations() re-creates it from
// the registration's own "Individual Sponsorship" fee on every page load
// unless its id is excluded here. Sponsors added directly (web sign-up form,
// or manually in-app) are NOT affected by this — they're deleted outright via
// sponsor-submissions.php and never get re-synced.
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

$file = __DIR__ . '/deleted-sponsors.json';
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'ids' => carshow_read_json_list($file)]);
    exit;
}

if ($action === 'add') {
    $incoming = $input['ids'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing ids.']);
        exit;
    }
    $existing = carshow_read_json_list($file);
    $merged = array_values(array_unique(array_merge($existing, array_map('strval', $incoming))));
    if (!carshow_write_json($file, $merged)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'ids' => $merged]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
