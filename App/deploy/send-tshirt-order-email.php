<?php
// Officer-only endpoint to send the T-Shirt Order Email
// (T-Shirts tab > T-Shirt Order Form). Same session/password dual auth
// as every other endpoint here (lib.php's carshow_authed()) — since the
// caller is already an authenticated officer, a client-supplied "to" is
// trusted here (unlike, say, the external Paid Registrations API). Falls
// back to the Vendor Email configured in Developer > Settings > T-Shirt
// Vendor if the client didn't supply one.
//
// Action: send (POST, JSON body with to + subject + body; cc/bcc optional).
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true) ?? [];
if (!carshow_authed($PASSWORD_HASH, $data['password'] ?? ($_POST['password'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$to = trim($data['to'] ?? '');
$subject = $data['subject'] ?? '';
$body = $data['body'] ?? '';
$cc = $data['cc'] ?? '';
$bcc = $data['bcc'] ?? '';

if (!$subject || !$body) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing subject or body.']);
    exit;
}

$recipient = $to;
if (!$recipient) {
    $settingsFile = __DIR__ . '/app-settings.json';
    $defaults = [
        'walkinFirstNonMember' => 2000,
        'walkInCarShowFee' => 50,
        'walkInNonCarShowFee' => 0,
        'preregistrationFee' => 40,
        'windowCardPdf' => '',
        'tshirtVendorEmail' => '',
        'tshirtEventPurchaseCost' => 0,
        'externalApiKey' => ''
    ];
    $raw = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : []);
    $recipient = $settings['tshirtVendorEmail'] ?? '';
}
if (!$recipient || strpos($recipient, '@') === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No valid recipient — type a To address, or configure a T-Shirt Vendor email in Settings.']);
    exit;
}

if (carshow_send_mail($recipient, $subject, $body, $cc, $bcc)) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not send the email — SMTP may not be configured (see secrets.php) or the send failed.']);
}
