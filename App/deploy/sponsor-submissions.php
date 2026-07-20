<?php
// Sponsor list read/write API for sponsor-submissions.json (contains PII).
// This is the single always-current sponsor list: the hosted index.php
// reads it fresh on every page load, and the Sponsors tab reads it on load
// and pushes every add/edit/delete (and the bulk-delete/"Remove All"
// actions) here immediately. member-sponsor-form.php / public-sponsor-form.php
// only ever append to this same file directly (see those files), not
// through this API.
//
// Actions: list (default), upsert, delete, clear.
//
// Auth via lib.php's carshow_authed() — same PHP-session-or-password dual
// check every endpoint here uses, though in practice the Sponsors tab only
// ever calls this same-origin, with an already-authenticated session.
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

$file = __DIR__ . '/sponsor-submissions.json';
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'sponsors' => carshow_read_json_list($file)]);
    exit;
}

if ($action === 'clear') {
    if (!carshow_write_json($file, [])) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'upsert') {
    $record = $input['sponsor'] ?? null;
    if (!is_array($record) || empty($record['name'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Sponsor name is required.']);
        exit;
    }
    if (empty($record['id'])) {
        $record['id'] = 'sp' . str_replace('.', '', uniqid('', true));
    }
    $list = carshow_read_json_list($file);
    $found = false;
    foreach ($list as $i => $s) {
        if (($s['id'] ?? null) === $record['id']) {
            $list[$i] = $record;
            $found = true;
            break;
        }
    }
    if (!$found) $list[] = $record;
    if (!carshow_write_json($file, array_values($list))) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'sponsor' => $record]);
    exit;
}

if ($action === 'delete') {
    $id = (string)($input['id'] ?? '');
    $list = carshow_read_json_list($file);
    $list = array_values(array_filter($list, function ($s) use ($id) {
        return ($s['id'] ?? null) !== $id;
    }));
    if (!carshow_write_json($file, $list)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
