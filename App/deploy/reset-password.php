<?php
// Reached via the link forgot-password.php emails to the admin address.
// Validates the one-time token from password-reset.json (gitignored,
// blocked from direct HTTP access by .htaccess), then lets the visitor set
// a new password — writing a fresh SHA-512-crypt hash directly into
// secrets.php, replacing it wholesale (same hash format `openssl passwd -6`
// produces, so index.php's crypt() check keeps working unchanged). The
// token is deleted after one use.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require __DIR__ . '/lib.php';

$RESET_FILE = __DIR__ . '/password-reset.json';
$SECRETS_FILE = __DIR__ . '/secrets.php';

$token = (string)($_GET['token'] ?? $_POST['token'] ?? '');
$reset = carshow_read_json_list($RESET_FILE); // {token,expiresAt} decodes fine via this JSON-object-or-empty-array helper
$valid = isset($reset['token'], $reset['expiresAt']) &&
    is_string($reset['token']) && $token !== '' &&
    hash_equals($reset['token'], $token) && time() < (int)$reset['expiresAt'];

$errors = [];
$done = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $valid) {
    $pw1 = (string)($_POST['password'] ?? '');
    $pw2 = (string)($_POST['password2'] ?? '');
    if (strlen($pw1) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    } elseif ($pw1 !== $pw2) {
        $errors[] = 'Passwords do not match.';
    } else {
        $newHash = crypt($pw1, '$6$' . bin2hex(random_bytes(8)) . '$');
        $php = "<?php\n" .
            "// Not committed to git (see .gitignore) — the live site's actual password hash.\n" .
            "\$PASSWORD_HASH = " . var_export($newHash, true) . ";\n";
        if (file_put_contents($SECRETS_FILE, $php, LOCK_EX) !== false) {
            @unlink($RESET_FILE); // one-time use
            $done = true;
        } else {
            $errors[] = 'Could not save the new password — please try again.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Car Show — Reset Password</title>
<style>
  :root { --red:#b0141e; --red-dark:#7d0e15; --ink:#1a1a1a; --muted:#667085; --line:#e3e6ea; --bg:#f4f6f8; --panel:#fff; --good:#147d3a; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin:0; padding: 40px 16px; }
  .wrap { max-width: 440px; margin: 0 auto; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 2px; }
  .sub { text-align:center; color:var(--muted); font-size:13px; margin-bottom:22px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }
  .form-row { margin: 12px 0; }
  label { display:block; font-weight:600; font-size:13px; margin-bottom:4px; }
  input[type=password] { width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:14px; font-family:inherit; }
  .btn { background: var(--red); border: 1px solid var(--red-dark); color:#fff; padding: 11px 18px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; width:100%; margin-top:8px; }
  .btn:hover { background: var(--red-dark); }
  .errors { background:#fff5f5; border-left:4px solid var(--red); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--red-dark); font-size:13px; }
  .success { color: var(--good); font-weight:600; text-align:center; }
  .back { display:block; text-align:center; margin-top:18px; color: var(--muted); font-size:13px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Reset Password</h1>
  <div class="sub">East Tennessee Corvette Club — Car Show app</div>
  <div class="panel">
    <?php if ($done): ?>
      <p class="success">Password changed. You can log in with it now.</p>
    <?php elseif (!$valid): ?>
      <div class="errors"><p style="margin:0">This reset link is invalid or has expired. Request a new one.</p></div>
    <?php else: ?>
      <?php if ($errors): ?>
        <div class="errors"><?php foreach ($errors as $e) echo '<p style="margin:0">' . htmlspecialchars($e) . '</p>'; ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="token" value="<?php echo htmlspecialchars($token); ?>">
        <div class="form-row">
          <label for="f-pw1">New Password</label>
          <input type="password" id="f-pw1" name="password" required minlength="8" autofocus>
        </div>
        <div class="form-row">
          <label for="f-pw2">Confirm New Password</label>
          <input type="password" id="f-pw2" name="password2" required minlength="8">
        </div>
        <button type="submit" class="btn">Set New Password</button>
      </form>
    <?php endif; ?>
  </div>
  <a class="back" href="index.php">&larr; Back to login</a>
</div>
</body>
</html>
