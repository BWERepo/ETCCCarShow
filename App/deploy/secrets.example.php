<?php
// Copy this file to secrets.php (gitignored) and fill in the real values.
// $PASSWORD_HASH: generate with
//   openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-actual-password'
$PASSWORD_HASH = '$6$replace-with-real-salt$replaceWithRealHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.';

// SMTP credentials used by forgot-password.php (via carshow_send_mail() in
// lib.php) to send the reset email reliably — PHP's raw mail() was observed
// silently failing to deliver to Gmail from this Hostinger account (no
// SPF/DKIM behind it). A mailbox created in hPanel > Emails works; port 465
// is implicit TLS, 587 is STARTTLS.
$SMTP_HOST = 'smtp.hostinger.com';
$SMTP_PORT = 465;
$SMTP_USER = 'replace-with-real-mailbox@etccapps.com';
$SMTP_PASS = 'replace-with-real-mailbox-password';
$SMTP_FROM = 'replace-with-real-mailbox@etccapps.com';
