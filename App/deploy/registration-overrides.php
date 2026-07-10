<?php
// Field-level edit overrides for registration rows — registration-overrides.json
// is a flat object, csvRegKey(rec) -> patch (see app.js), NOT a list of full
// records. Applies to BOTH CSV-imported and Walk-In rows conceptually, but in
// practice app.js only ever writes here for CSV-derived rows (Walk-Ins have
// their own full server record in walkin-registrations.json and are edited by
// updating that record directly via walkin-registrations.php instead).
//
// A CSV row has no per-row server record of its own — registrations-data.json
// is wholly replaced by every fresh import — so persisting an edit means
// storing just the changed fields, keyed by the row's stable Reg-Date+name
// identity, and re-applying that patch on top of the freshly-parsed CSV every
// page load. Same architecture as deleted-registrations.json, but a patch
// object per key instead of a bare exclusion list.
//
// Actions: list (default), upsert.
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

$file = __DIR__ . '/registration-overrides.json';
$action = (string)($input['action'] ?? 'list');

function ro_read_map($file) {
    if (!is_file($file)) return [];
    $raw = file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : [];
    return is_array($decoded) ? $decoded : [];
}

if ($action === 'list') {
    echo json_encode(['ok' => true, 'overrides' => ro_read_map($file)]);
    exit;
}

if ($action === 'upsert') {
    $key = (string)($input['key'] ?? '');
    $patch = $input['patch'] ?? null;
    if ($key === '' || !is_array($patch)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing key or patch.']);
        exit;
    }
    $map = ro_read_map($file);
    $map[$key] = $patch; // full replace for this key — the form always submits every editable field together
    if (!carshow_write_json($file, $map)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'overrides' => $map]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
