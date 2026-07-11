<?php
// Officer-only endpoint to send the T-Shirt Order Email
// (Developer > 📧 T-Shirt Order Email). Same session/password dual auth
// as every other endpoint here (lib.php's carshow_authed()).
//
// The recipient address (tshirtVendorEmail) is deliberately read server-side
// from app-settings.json, never trusted from the client — this keeps the
// Settings modal as the single source of truth for who receives these emails.
// Prevents accidental or malicious mis-routing to a typed-in address.
//
// Action: send (POST, JSON body with subject + body).
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/lib.php';

header('Content-Type: application/json');

if (!carshow_authed($_POST['password'] ?? '')) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$subject = $data['subject'] ?? '';
$body = $data['body'] ?? '';
$cc = $data['cc'] ?? '';
$bcc = $data['bcc'] ?? '';

if (!$subject || !$body) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing subject or body.']);
    exit;
}

$settingsFile = __DIR__ . '/app-settings.json';
$defaults = [
    'walkinFirstNonMember' => 2000,
    'walkInCarShowFee' => 50,
    'walkInNonCarShowFee' => 0,
    'preregistrationFee' => 40,
    'windowCardPdf' => '',
    'tshirtVendorEmail' => '',
    'externalApiKey' => ''
];
$raw = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$settings = array_merge($defaults, is_array($raw) ? $raw : []);

$recipient = $settings['tshirtVendorEmail'] ?? '';
if (!$recipient) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No T-Shirt Vendor email configured in app settings.']);
    exit;
}

if (carshow_send_mail($recipient, $subject, $body, $cc, $bcc)) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not send the email — SMTP may not be configured (see secrets.php) or the send failed.']);
}
