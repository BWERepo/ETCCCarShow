<?php
// Walk-In registration read/write API for walkin-registrations.json.
// Manually-added Walk-In Member/Nonmember rows from the Registration tab's
// "+ Add Registration" form — a separate, always-current list independent
// of registrations-data.json (which is wholly replaced by every CSV
// import). index.php reads this fresh on every page load, and the
// Registration tab pushes every add/delete here immediately, same pattern
// as sponsor-submissions.php.
//
// Actions: list (default), upsert, delete.
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

$file = __DIR__ . '/walkin-registrations.json';
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'registrations' => carshow_read_json_list($file)]);
    exit;
}

if ($action === 'upsert') {
    $record = $input['registration'] ?? null;
    if (!is_array($record) || empty($record['Last Name'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Last Name is required.']);
        exit;
    }
    if (empty($record['id'])) {
        $record['id'] = 'wk' . str_replace('.', '', uniqid('', true));
    }
    $list = carshow_read_json_list($file);
    $found = false;
    foreach ($list as $i => $r) {
        if (($r['id'] ?? null) === $record['id']) {
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
    echo json_encode(['ok' => true, 'registration' => $record]);
    exit;
}

if ($action === 'delete') {
    $id = (string)($input['id'] ?? '');
    $list = carshow_read_json_list($file);
    $list = array_values(array_filter($list, function ($r) use ($id) {
        return ($r['id'] ?? null) !== $id;
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
