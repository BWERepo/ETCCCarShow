<?php
// Officer-only page to import the ETCC membership roster (a CSV export with
// last_name/first_name columns — spacing/underscore/case-insensitive, so
// "Last Name" or "LastName" work too) into members-data.json (gitignored,
// contains member PII, blocked from direct HTTP access by .htaccess).
// sponsor-form.php reads that file to populate the ETCC Member Name
// datalist/autocomplete and to validate submissions against it.
//
// Gated by the same PHP session as index.php — no separate password prompt,
// but you must already be logged into the app to reach this page.
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

$MEMBERS_FILE = __DIR__ . '/members-data.json';
$errors = [];
$imported = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['members_csv'])) {
    $file = $_FILES['members_csv'];
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        $errors[] = 'Upload failed — choose a CSV file and try again.';
    } else {
        $lines = file($file['tmp_name']);
        if (!$lines || count($lines) < 2) {
            $errors[] = 'That file looks empty.';
        } else {
            $header = str_getcsv(array_shift($lines));
            $lastIdx = null;
            $firstIdx = null;
            // Normalize away spaces/underscores/case so "Last Name", "last_name",
            // "LastName", etc. all match — different exports name these differently.
            foreach ($header as $i => $h) {
                $h = str_replace([' ', '_'], '', strtolower(trim($h)));
                if ($h === 'lastname') $lastIdx = $i;
                if ($h === 'firstname') $firstIdx = $i;
            }
            if ($lastIdx === null || $firstIdx === null) {
                $errors[] = 'CSV must have "last_name" and "first_name" (or "Last Name" / "First Name") columns.';
            } else {
                $members = [];
                $seen = [];
                foreach ($lines as $line) {
                    if (trim($line) === '') continue;
                    $cols = str_getcsv($line);
                    $last = trim($cols[$lastIdx] ?? '');
                    $first = trim($cols[$firstIdx] ?? '');
                    if ($last === '') continue;
                    $name = $last . ($first !== '' ? ', ' . $first : '');
                    $key = strtolower($name);
                    if (isset($seen[$key])) continue;
                    $seen[$key] = true;
                    $members[] = ['name' => $name, 'lastName' => $last, 'firstName' => $first];
                }
                usort($members, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
                if (carshow_write_json($MEMBERS_FILE, $members)) {
                    $imported = count($members);
                } else {
                    $errors[] = 'Could not save the member list — please try again.';
                }
            }
        }
    }
}

$current = carshow_read_json_list($MEMBERS_FILE);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Car Show — Import Member Database</title>
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
  <h1>Import ETCC Member Database</h1>
  <div class="sub">Used to validate the "ETCC Member Name" field on the public sponsor form</div>
  <div class="panel">
    <?php if ($imported !== null): ?>
      <div class="success">Imported <?php echo $imported; ?> member name<?php echo $imported === 1 ? '' : 's'; ?>.</div>
    <?php endif; ?>
    <?php if ($errors): ?>
      <div class="errors"><strong>Please fix the following:</strong><ul>
        <?php foreach ($errors as $e) echo '<li>' . htmlspecialchars($e) . '</li>'; ?>
      </ul></div>
    <?php endif; ?>
    <div class="count">Current roster: <strong><?php echo count($current); ?></strong> member name<?php echo count($current) === 1 ? '' : 's'; ?>.</div>
    <form method="post" enctype="multipart/form-data">
      <div class="form-row">
        <label for="f-csv">Member CSV (needs last_name and first_name columns)</label>
        <input type="file" id="f-csv" name="members_csv" accept=".csv" required>
      </div>
      <button type="submit" class="btn">Import</button>
    </form>
  </div>
  <a class="back" href="index.php">&larr; Back to the app</a>
</div>
</body>
</html>
