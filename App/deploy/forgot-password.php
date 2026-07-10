<?php
// Public "forgot password" request page, linked from _login.html.
//
// This site has ONE shared password (no per-user accounts — see secrets.php),
// so a self-service reset with no identity check would just let anyone reset
// it. Instead, this emails a time-limited reset link to the club's fixed
// admin address (ADMIN_EMAIL below) — whoever controls that inbox is the
// person who should be able to reset the site password, which is a
// reasonable proxy for identity in a single-shared-password model. The
// visitor never supplies or sees an email address.
//
// Uses PHP's mail() — reliability depends on how this Hostinger account has
// mail configured. If the reset email never arrives, fall back to
// regenerating the hash manually (see README.md: `openssl passwd -6 ...`)
// and updating secrets.php directly.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require __DIR__ . '/lib.php';

$ADMIN_EMAIL = 'etccwebsite.webmanager@gmail.com';
$RESET_URL_BASE = 'https://etccapps.com/apps/carshow/reset-password.php';
$RESET_FILE = __DIR__ . '/password-reset.json';
$TOKEN_TTL_SECONDS = 3600; // 1 hour

$sent = false;
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = bin2hex(random_bytes(32));
    $data = ['token' => $token, 'expiresAt' => time() + $TOKEN_TTL_SECONDS];
    if (!carshow_write_json($RESET_FILE, $data)) {
        $errors[] = 'Could not start a password reset right now — please try again in a moment.';
    } else {
        $resetUrl = $RESET_URL_BASE . '?token=' . $token;
        $subject = 'ETCC Car Show app — password reset requested';
        $body = "A password reset was requested for the Car Show app's login.\n\n" .
            "Reset it here (link expires in 1 hour):\n" . $resetUrl . "\n\n" .
            "If you didn't request this, you can ignore this email — the link " .
            "expires on its own and nothing changes until someone opens it.";
        $headers = "From: no-reply@etccapps.com\r\n";
        if (@mail($ADMIN_EMAIL, $subject, $body, $headers)) {
            $sent = true;
        } else {
            $errors[] = 'Could not send the reset email — this server may not have outgoing mail configured. Ask a developer to reset the password directly instead (see deploy/README.md).';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Car Show — Forgot Password</title>
<style>
  :root { --red:#b0141e; --red-dark:#7d0e15; --ink:#1a1a1a; --muted:#667085; --line:#e3e6ea; --bg:#f4f6f8; --panel:#fff; --good:#147d3a; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin:0; padding: 40px 16px; }
  .wrap { max-width: 440px; margin: 0 auto; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 2px; }
  .sub { text-align:center; color:var(--muted); font-size:13px; margin-bottom:22px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 24px; text-align: center; }
  .btn { background: var(--red); border: 1px solid var(--red-dark); color:#fff; padding: 11px 18px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; width:100%; }
  .btn:hover { background: var(--red-dark); }
  .errors { background:#fff5f5; border-left:4px solid var(--red); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--red-dark); font-size:13px; text-align:left; }
  .success { color: var(--good); font-weight:600; }
  .back { display:block; text-align:center; margin-top:18px; color: var(--muted); font-size:13px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Forgot Password</h1>
  <div class="sub">East Tennessee Corvette Club — Car Show app</div>
  <div class="panel">
    <?php if ($sent): ?>
      <p class="success">A reset link has been emailed. Check the club's admin inbox — it's valid for 1 hour.</p>
    <?php else: ?>
      <?php if ($errors): ?>
        <div class="errors"><?php foreach ($errors as $e) echo '<p style="margin:0">' . htmlspecialchars($e) . '</p>'; ?></div>
      <?php endif; ?>
      <p>This site has one shared login, so resets go to the club's admin email rather than one you'd type here.</p>
      <form method="post">
        <button type="submit" class="btn">Email a reset link</button>
      </form>
    <?php endif; ?>
  </div>
  <a class="back" href="index.php">&larr; Back to login</a>
</div>
</body>
</html>
