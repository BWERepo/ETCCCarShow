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
//  - windowCardPdf: filename (currently always "window-card.pdf" once
//    uploaded) of the current Car Show Window Card fillable PDF template,
//    uploaded via window-card-pdf.php (Developer > Settings > Car Show
//    Window Card) — that endpoint owns the actual file upload/storage and
//    writes this key directly; this file only ever reads/passes it through.
//    Empty string means no template has been uploaded yet. app.js fills the
//    template's Owner/CarNumber/Year/Model/Generation AcroForm fields
//    client-side via pdf-lib.
//  - tshirtVendorEmail: reference contact only (Developer > Settings > T-Shirt
//    Vendor) — not used to send anything automatically anywhere in the app.
//  - tshirtEventPurchaseCost: reference figure for officers selling shirts at
//    the event (Developer > Settings > T-Shirt Vendor) — not applied
//    anywhere automatically.
//  - sponsorEmailTo / sponsorEmailCc / sponsorEmailBcc / sponsorEmailSubject:
//    New Sponsor Confirmation Email (Developer > Settings) — sponsor-form.php
//    sends a professional HTML confirmation email here (best-effort, never
//    blocks the actual submission) whenever a sponsorship is submitted.
//    Leave sponsorEmailTo blank to disable sending entirely. To/CC/BCC each
//    accept comma/semicolon-separated multiple addresses.
//  - externalApiKey: credential for the EXTERNAL Paid Registrations API
//    (paid-registrations-api.php) — a separate, narrower credential than
//    this app's own site password, meant to be handed to another website's
//    developer rather than an officer. Generated at random
//    (bin2hex(random_bytes(16))) the first time it's read (here or in
//    index.php's boot script, whichever runs first persists it) — never
//    hardcoded, since this file is committed to a public repo. Rotated via
//    action=rotate_api_key, from the Developer > API screen.
//
// Actions: get (default), save, rotate_api_key.
//
// Auth via lib.php's carshow_authed() — same PHP-session-or-password dual
// check every endpoint here uses (including rotate_api_key — this gates on
// the SITE's own password, same as every other Developer action; the api
// key itself is a completely separate credential for the EXTERNAL caller of
// paid-registrations-api.php, not for reaching this endpoint).
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
    'preregistrationFee' => 40,
    'windowCardPdf' => '',
    'tshirtVendorEmail' => '',
    'tshirtEventPurchaseCost' => 0,
    'sponsorEmailTo' => '',
    'sponsorEmailCc' => '',
    'sponsorEmailBcc' => '',
    'sponsorEmailSubject' => 'New Sponsor Submission'
];

if ($action === 'get') {
    $raw = is_file($file) ? json_decode(file_get_contents($file), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : []);
    if (empty($settings['externalApiKey'])) {
        $settings['externalApiKey'] = bin2hex(random_bytes(16));
        carshow_write_json($file, $settings);
    }
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

// Regenerates externalApiKey (see comment above) — a separate action rather
// than a special case of save, so the client never has to round-trip the
// old key value just to replace it.
if ($action === 'rotate_api_key') {
    $raw = is_file($file) ? json_decode(file_get_contents($file), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : []);
    $settings['externalApiKey'] = bin2hex(random_bytes(16));
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
