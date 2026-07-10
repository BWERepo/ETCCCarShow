<?php
// Tracks which CSV-derived registration rows have been removed via the
// Registration tab's checkbox/bulk-delete — deleted-registrations.json is
// just a flat array of csvRegKey() strings (see app.js), not full records.
// CSV rows have no per-row server record of their own (registrations-data.json
// is wholly replaced by every fresh import), so "deleting" one means
// excluding its key from every future page load's regenerate() — including a
// later re-import that still contains the same row. Walk-In rows are NOT
// tracked here; they're deleted outright via walkin-registrations.php.
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

$file = __DIR__ . '/deleted-registrations.json';
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'keys' => carshow_read_json_list($file)]);
    exit;
}

if ($action === 'add') {
    $incoming = $input['keys'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing keys.']);
        exit;
    }
    $existing = carshow_read_json_list($file);
    $merged = array_values(array_unique(array_merge($existing, array_map('strval', $incoming))));
    if (!carshow_write_json($file, $merged)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'keys' => $merged]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
