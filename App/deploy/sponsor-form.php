<?php
// Sponsor sign-up form — behind the SAME password gate as index.php (shared
// $PASSWORD_HASH/session from secrets.php, not a separate credential). It's
// still meant to be linked/embedded from another website; officers hand the
// site password out to sponsors/businesses that need to submit here, same as
// anyone else who needs the main app. Submissions are appended to
// sponsor-submissions.json (gitignored, contains PII) via lib.php's
// lock-guarded read-modify-write.
//
// sponsor-submissions.json is now the single always-current sponsor list —
// the hosted index.php reads it fresh on every page load, and the Sponsors
// tab (when viewed on the hosted site) reads/writes it live through
// sponsor-submissions.php instead of caching to localStorage. This page
// itself only ever appends; it never serves the accumulated list back out.
//
// Field set intentionally matches App/src/config.js's SPONSOR_TYPES /
// SPONSOR_SHIRT_SIZES and the Sponsors tab's record shape exactly, so a
// submission here can be merged straight into the app with no translation.
// This page isn't part of build.js's src/ pipeline, so if those config
// lists change, update the two arrays below to match.
//
// ETCC Member Name is a free-text field constrained by a <datalist> and
// validated server-side against members-data.json (imported via
// members-import.php from a club membership CSV) — not a boolean checkbox.
// An empty value just means "not a member"; a non-empty value must match
// the roster exactly (case-insensitively) or the submission is rejected.

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
session_start();
require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

// Same login POST handling as index.php — kept in sync deliberately rather
// than factored out, since it's only a few lines and duplicating it here
// avoids adding a require-order dependency between the two pages.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    header('Content-Type: application/json');
    $pw = (string)($_POST['password'] ?? '');
    $ok = hash_equals($PASSWORD_HASH, crypt($pw, $PASSWORD_HASH));
    if ($ok) {
        session_regenerate_id(true);
        $_SESSION['carshow_authenticated'] = true;
        echo json_encode(['success' => true]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false]);
    }
    exit;
}

if (empty($_SESSION['carshow_authenticated'])) {
    // _login.html posts to location.pathname, so the same file works
    // unmodified from this page's own URL. Swap in copy that fits this
    // page's context instead of index.php's "registration & summary" text.
    $login = file_get_contents(__DIR__ . '/_login.html');
    $login = str_replace(
        'Enter password to access the Car Show registration &amp; summary',
        'Enter password to access the sponsor sign-up form',
        $login
    );
    echo $login;
    exit;
}

$SPONSOR_TYPES = [
    'premier' => 'Premier ($250)',
    'corporate' => 'Corporate ($100)',
    'individual' => 'Individual ($100)',
];
$SHIRT_SIZES = [
    "Men's Small", "Men's Medium", "Men's Large", "Men's Extra Large", "Men's 2XL", "Men's 3XL",
    "Women's Small", "Women's Medium", "Women's Large", "Women's Extra Large", "Women's 2XL", "Women's 3XL",
];

// Member roster (gitignored, contains member PII — see members-import.php)
// used only to populate the datalist suggestions and validate the ETCC
// Member Name field below. Blocked from direct HTTP access by .htaccess.
$members = carshow_read_json_list(__DIR__ . '/members-data.json');
$memberNames = []; // lowercased name -> canonical display name, for case-insensitive validation
foreach ($members as $m) {
    if (!empty($m['name'])) $memberNames[strtolower($m['name'])] = $m['name'];
}

$errors = [];
$submitted = false;
$values = [
    'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
    'website' => '', 'etccMemberName' => '', 'sponsorType' => 'premier', 'shirtSize' => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (['name', 'contactPerson', 'phone', 'email', 'address', 'website', 'etccMemberName'] as $f) {
        $values[$f] = trim((string)($_POST[$f] ?? ''));
    }
    $values['sponsorType'] = (string)($_POST['sponsorType'] ?? '');
    $values['shirtSize'] = (string)($_POST['shirtSize'] ?? '');

    if ($values['name'] === '') $errors[] = 'Sponsor Name is required.';
    if (!array_key_exists($values['sponsorType'], $SPONSOR_TYPES)) $errors[] = 'Choose a valid sponsor type.';
    if ($values['shirtSize'] !== '' && !in_array($values['shirtSize'], $SHIRT_SIZES, true)) $errors[] = 'Choose a valid T-shirt size.';
    if ($values['etccMemberName'] !== '') {
        $matched = $memberNames[strtolower($values['etccMemberName'])] ?? null;
        if ($matched === null) {
            $errors[] = 'ETCC Member Name not found in the roster — pick a name from the suggestions, or leave it blank if you\'re not a member.';
        } else {
            $values['etccMemberName'] = $matched; // normalize to the roster's canonical casing
        }
    }

    if (!$errors) {
        $record = [
            'id' => 'web' . str_replace('.', '', uniqid('', true)),
            'name' => $values['name'],
            'contactPerson' => $values['contactPerson'],
            'phone' => $values['phone'],
            'email' => $values['email'],
            'address' => $values['address'],
            'website' => $values['website'],
            'etccMemberName' => $values['etccMemberName'],
            'sponsorType' => $values['sponsorType'],
            'shirtSize' => $values['shirtSize'],
            'submittedAt' => gmdate('c'),
        ];
        $file = __DIR__ . '/sponsor-submissions.json';
        if (carshow_append_json_list($file, $record)) {
            $submitted = true;
            $values = [
                'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
                'website' => '', 'etccMemberName' => '', 'sponsorType' => 'premier', 'shirtSize' => '',
            ];
        } else {
            $errors[] = 'Could not save your submission right now — please try again in a moment.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Car Show — Become a Sponsor</title>
<style>
  :root { --red:#b0141e; --red-dark:#7d0e15; --ink:#1a1a1a; --muted:#667085; --line:#e3e6ea; --bg:#f4f6f8; --panel:#fff; --good:#147d3a; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin:0; padding: 28px 16px 60px; }
  .wrap { max-width: 560px; margin: 0 auto; }
  .logo { display:block; height:64px; width:64px; object-fit:contain; margin: 0 auto 10px; border-radius:6px; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 2px; }
  .sub { text-align:center; color:var(--muted); font-size:13px; margin-bottom:22px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 22px 24px; }
  .form-row { margin: 12px 0; }
  label { display:block; font-weight:600; font-size:13px; margin-bottom:4px; }
  input[type=text], input[type=email], input[type=tel], input[type=url], select {
    width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:14px; font-family:inherit; color: var(--ink); background: #fff;
  }
  .checkbox-row { display:flex; align-items:center; gap:8px; }
  .checkbox-row label { margin:0; font-weight:600; }
  .checkbox-row input { width:auto; }
  .btn { background: var(--red); border: 1px solid var(--red-dark); color:#fff; padding: 11px 18px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; width:100%; margin-top:10px; }
  .btn:hover { background: var(--red-dark); }
  .btn-row { display:flex; gap:10px; }
  .btn-row .btn { margin-top:10px; }
  .btn-secondary { background:#fff; border:1px solid var(--line); color: var(--ink); }
  .btn-secondary:hover { background:#f4f6f8; }
  .errors { background:#fff5f5; border-left:4px solid var(--red); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--red-dark); font-size:13px; }
  .errors ul { margin:4px 0 0; padding-left:18px; }
  .success { background:#f2fbf5; border:1px solid #bfe2c9; border-radius:10px; padding:24px; text-align:center; color: var(--good); font-weight:600; }
  .footer { text-align:center; color:var(--muted); font-size:11px; margin-top:22px; }
</style>
</head>
<body>
<div class="wrap">
  <img src="ETCClogoWhiteBackground.png" alt="ETCC Logo" class="logo">
  <h1>Become a Car Show Sponsor</h1>
  <div class="sub">East Tennessee Corvette Club</div>
  <div class="panel">
  <?php if ($submitted): ?>
    <div class="success">Thank you! Your sponsorship information has been submitted.</div>
  <?php else: ?>
    <?php if ($errors): ?>
      <div class="errors"><strong>Please fix the following:</strong><ul>
        <?php foreach ($errors as $e) echo '<li>' . htmlspecialchars($e) . '</li>'; ?>
      </ul></div>
    <?php endif; ?>
    <form method="post" novalidate>
      <div class="form-row">
        <label for="f-name">Sponsor Name *</label>
        <input type="text" id="f-name" name="name" required value="<?php echo htmlspecialchars($values['name']); ?>">
      </div>
      <div class="form-row">
        <label for="f-contact">Contact Person</label>
        <input type="text" id="f-contact" name="contactPerson" value="<?php echo htmlspecialchars($values['contactPerson']); ?>">
      </div>
      <div class="form-row">
        <label for="f-phone">Phone</label>
        <input type="tel" id="f-phone" name="phone" value="<?php echo htmlspecialchars($values['phone']); ?>">
      </div>
      <div class="form-row">
        <label for="f-email">Email</label>
        <input type="email" id="f-email" name="email" value="<?php echo htmlspecialchars($values['email']); ?>">
      </div>
      <div class="form-row">
        <label for="f-address">Address</label>
        <input type="text" id="f-address" name="address" value="<?php echo htmlspecialchars($values['address']); ?>">
      </div>
      <div class="form-row">
        <label for="f-website">Website</label>
        <input type="url" id="f-website" name="website" placeholder="https://" value="<?php echo htmlspecialchars($values['website']); ?>">
      </div>
      <div class="form-row">
        <label for="f-member">ETCC Member Name</label>
        <input type="text" id="f-member" name="etccMemberName" list="etcc-members" autocomplete="off"
          placeholder="Start typing your last name…" value="<?php echo htmlspecialchars($values['etccMemberName']); ?>">
        <datalist id="etcc-members">
          <?php foreach ($members as $m): ?>
            <?php if (!empty($m['name'])): ?>
              <option value="<?php echo htmlspecialchars($m['name']); ?>">
            <?php endif; ?>
          <?php endforeach; ?>
        </datalist>
      </div>
      <div class="form-row">
        <label for="f-type">Sponsor Type *</label>
        <select id="f-type" name="sponsorType">
          <?php foreach ($SPONSOR_TYPES as $key => $label): ?>
            <option value="<?php echo htmlspecialchars($key); ?>" <?php echo $values['sponsorType'] === $key ? 'selected' : ''; ?>><?php echo htmlspecialchars($label); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-row">
        <label for="f-shirt">T-Shirt Size</label>
        <select id="f-shirt" name="shirtSize">
          <option value="">— none —</option>
          <?php foreach ($SHIRT_SIZES as $sz): ?>
            <option value="<?php echo htmlspecialchars($sz); ?>" <?php echo $values['shirtSize'] === $sz ? 'selected' : ''; ?>><?php echo htmlspecialchars($sz); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" onclick="location.href='https://www.etccwebsite.com/content.aspx?page_id=0&amp;club_id=313652'">Cancel</button>
        <button type="submit" class="btn">Submit Sponsorship</button>
      </div>
    </form>
  <?php endif; ?>
  </div>
  <div class="footer">&copy; 2026 East Tennessee Corvette Club &middot; Knoxville, TN &middot; etccwebsite.webmanager@gmail.com</div>
</div>
</body>
</html>
