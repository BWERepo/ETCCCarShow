<?php
// Officer-only upload endpoint for the Car Show Window Card fillable PDF
// template (Developer > Settings > Car Show Window Card). Same PHP-session-
// or-password dual auth as every other endpoint here (lib.php's
// carshow_authed()).
//
// Saves the uploaded PDF to disk as window-card.pdf (10 MB max), overwriting
// any prior upload. Deliberately NOT written into app-settings.json as
// base64 (would bloat that small JSON file and every settings save/load);
// instead it's a plain static file (same pattern as
// ETCClogoWhiteBackground.png / the old window-card.<ext> background image),
// and app-settings.json's windowCardPdf key just tracks its current filename
// so app.js knows what to reference.
//
// Not denied by .htaccess like the data JSON files — this PDF is meant to be
// publicly fetchable (fetch("window-card.pdf")) so app.js's pdf-lib code can
// load its bytes client-side and fill the form fields per registrant.
//
// The template's AcroForm fields (filled by app.js's printWindowCards()) are
// expected to be: Owner, CarNumber, Year, Model, Generation.
//
// Action: upload (multipart POST, file field "pdf").
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

header('Content-Type: application/json');

if (!carshow_authed($PASSWORD_HASH, $_POST['password'] ?? '')) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

if (empty($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($_FILES['pdf']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No PDF uploaded, or the upload failed.']);
    exit;
}

$file = $_FILES['pdf'];
if ($file['size'] > 10 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'PDF is too large (10 MB max).']);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
if ($mime !== 'application/pdf') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unsupported file type — upload a PDF.']);
    exit;
}

$newFilename = 'window-card.pdf';

if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/' . $newFilename)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not save the PDF.']);
    exit;
}

$settingsFile = __DIR__ . '/app-settings.json';
$defaults = [
    'walkinFirstNonMember' => 2000,
    'walkInCarShowFee' => 50,
    'walkInNonCarShowFee' => 0,
    'preregistrationFee' => 40,
    'windowCardPdf' => '',
    'tshirtVendorEmail' => ''
];
$raw = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$settings = array_merge($defaults, is_array($raw) ? $raw : []);
$settings['windowCardPdf'] = $newFilename;

if (!carshow_write_json($settingsFile, $settings)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'PDF saved, but could not update settings.']);
    exit;
}

echo json_encode(['ok' => true, 'windowCardPdf' => $newFilename]);
