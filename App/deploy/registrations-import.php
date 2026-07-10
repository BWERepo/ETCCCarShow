<?php
// Officer-only page to upload a fresh Registration Data / Activity Registrant
// Data CSV pair (see AUTOPULL-NOTES.md and README.md for where these come
// from — ClubExpress's Event Exports dialog) straight into
// registrations-data.json (gitignored, contains PII), the same file
// registrations-upload.php writes. index.php reads this file fresh on every
// request, so an upload here is live for the very next page load — no
// node build.js / ftp-deploy.sh cycle needed just to refresh data.
//
// This is the browser-based sibling of registrations-upload.php (which is
// meant for deploy/upload-registrations.js's automated CLI flow) — same
// destination file, same shape, just a form instead of a script + password
// env var. Gated by the same PHP session as index.php, same pattern as
// members-import.php.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

if (empty($_SESSION['carshow_authenticated'])) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:40px;text-align:center">' .
        '<p>Please <a href="index.php">log in</a> first.</p></body>';
    exit;
}

$REG_FILE = __DIR__ . '/registrations-data.json';
$errors = [];
$imported = null; // ['regRows' => int, 'actRows' => int] on success

function csvDataRowCount($tmpName) {
    $lines = file($tmpName);
    if (!$lines) return 0;
    // Header line doesn't count as a data row; blank trailing lines don't either.
    $count = 0;
    foreach (array_slice($lines, 1) as $line) {
        if (trim($line) !== '') $count++;
    }
    return $count;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['reg_csv'])) {
    $regFile = $_FILES['reg_csv'];
    $actFile = $_FILES['act_csv'] ?? null;
    if ($regFile['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($regFile['tmp_name'])) {
        $errors[] = 'Registration Data upload failed — choose a CSV file and try again.';
    } elseif ($actFile && $actFile['error'] !== UPLOAD_ERR_OK && $actFile['error'] !== UPLOAD_ERR_NO_FILE) {
        $errors[] = 'Activity Registrant Data upload failed — choose a CSV file and try again.';
    } else {
        $regCsv = file_get_contents($regFile['tmp_name']);
        $actCsv = ($actFile && $actFile['error'] === UPLOAD_ERR_OK && is_uploaded_file($actFile['tmp_name']))
            ? file_get_contents($actFile['tmp_name']) : '';
        if (trim((string)$regCsv) === '') {
            $errors[] = 'That Registration Data file looks empty.';
        } else {
            $regRows = csvDataRowCount($regFile['tmp_name']);
            $actRows = $actCsv !== '' ? csvDataRowCount($actFile['tmp_name']) : 0;
            $data = [
                'regCsv' => $regCsv,
                'actCsv' => $actCsv,
                'generatedAt' => (int)(microtime(true) * 1000),
                'uploadedAt' => gmdate('c'),
            ];
            if (carshow_write_json($REG_FILE, $data)) {
                $imported = ['regRows' => $regRows, 'actRows' => $actRows];
            } else {
                $errors[] = 'Could not save the registration data — please try again.';
            }
        }
    }
}

$current = is_file($REG_FILE) ? json_decode(file_get_contents($REG_FILE), true) : null;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Car Show — Import Registrations</title>
<style>
  :root { --red:#b0141e; --red-dark:#7d0e15; --ink:#1a1a1a; --muted:#667085; --line:#e3e6ea; --bg:#f4f6f8; --panel:#fff; --good:#147d3a; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin:0; padding: 28px 16px 60px; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 2px; }
  .sub { text-align:center; color:var(--muted); font-size:13px; margin-bottom:22px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 22px 24px; }
  .form-row { margin: 14px 0; }
  label { display:block; font-weight:600; font-size:13px; margin-bottom:4px; }
  input[type=file] { width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:14px; font-family:inherit; background:#fff; }
  .btn { background: var(--red); border: 1px solid var(--red-dark); color:#fff; padding: 11px 18px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; width:100%; margin-top:6px; }
  .btn:hover { background: var(--red-dark); }
  .errors { background:#fff5f5; border-left:4px solid var(--red); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--red-dark); font-size:13px; }
  .errors ul { margin:4px 0 0; padding-left:18px; }
  .success { background:#f2fbf5; border:1px solid #bfe2c9; border-radius:8px; padding:12px 14px; margin-bottom:14px; color: var(--good); font-weight:600; font-size:14px; }
  .count { color: var(--muted); font-size:13px; margin-bottom: 14px; }
  .back { display:block; text-align:center; margin-top:18px; color: var(--muted); font-size:13px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Import Registrations</h1>
  <div class="sub">Loads a fresh Registration Data / Activity Registrant Data CSV pair from ClubExpress</div>
  <div class="panel">
    <?php if ($imported !== null): ?>
      <div class="success">Imported <?php echo $imported['regRows']; ?> registration row<?php echo $imported['regRows'] === 1 ? '' : 's'; ?>
        and <?php echo $imported['actRows']; ?> activity row<?php echo $imported['actRows'] === 1 ? '' : 's'; ?>.</div>
    <?php endif; ?>
    <?php if ($errors): ?>
      <div class="errors"><strong>Please fix the following:</strong><ul>
        <?php foreach ($errors as $e) echo '<li>' . htmlspecialchars($e) . '</li>'; ?>
      </ul></div>
    <?php endif; ?>
    <?php if (is_array($current) && !empty($current['uploadedAt'])): ?>
      <div class="count">Current data was uploaded <?php echo htmlspecialchars($current['uploadedAt']); ?>.</div>
    <?php endif; ?>
    <form method="post" enctype="multipart/form-data">
      <div class="form-row">
        <label for="f-reg">Registration Data CSV</label>
        <input type="file" id="f-reg" name="reg_csv" accept=".csv" required>
      </div>
      <div class="form-row">
        <label for="f-act">Activity Registrant Data CSV (optional)</label>
        <input type="file" id="f-act" name="act_csv" accept=".csv">
      </div>
      <button type="submit" class="btn">Import</button>
    </form>
  </div>
  <a class="back" href="index.php">&larr; Back to the app</a>
</div>
</body>
</html>
