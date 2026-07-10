<?php
// EXTERNAL read-only API — the URL another website calls to read this car
// show's paid registrations. Deliberately does NOT use lib.php's
// carshow_authed() (this app's own officer site password) — that credential
// is for officers inside this app, not for a third-party website's server.
// Auth here is a separate, narrower key (app-settings.json's
// externalApiKey, generated at random — see index.php/app-settings.php —
// and shown/rotated from the Developer > API screen, app.js's
// renderApiPage()).
//
// Serves whatever paid-registrations-cache.php last wrote — see that file's
// comment for why this doesn't recompute anything itself: the officer's
// browser is the only place that runs logic.js's generate() pipeline.
//
// Accepts the key as either an X-Api-Key header or a ?key= query param, so
// it's callable from a plain browser address bar (handy for a developer to
// test with) or from server-side code.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: X-Api-Key, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

header('Content-Type: application/json');

$appSettingsFile = __DIR__ . '/app-settings.json';
$appSettingsRaw = is_file($appSettingsFile) ? json_decode(file_get_contents($appSettingsFile), true) : [];
$expectedKey = is_array($appSettingsRaw) ? (string)($appSettingsRaw['externalApiKey'] ?? '') : '';

$providedKey = (string)($_SERVER['HTTP_X_API_KEY'] ?? ($_GET['key'] ?? ''));

if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Invalid or missing API key.']);
    exit;
}

$cacheFile = __DIR__ . '/paid-registrations-cache.json';
$cache = is_file($cacheFile) ? json_decode(file_get_contents($cacheFile), true) : null;
$registrations = (is_array($cache) && is_array($cache['registrations'] ?? null)) ? $cache['registrations'] : [];
$generatedAt = is_array($cache) ? ($cache['generatedAt'] ?? null) : null;

echo json_encode([
    'ok' => true,
    'generatedAt' => $generatedAt,
    'count' => count($registrations),
    'registrations' => $registrations,
]);
