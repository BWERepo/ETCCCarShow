<?php
// Public sponsor sign-up form — deliberately NOT behind the site's password
// gate (index.php), because this page's whole point is to have a URL that
// can be linked/embedded from another website for sponsors to fill out
// themselves. Submissions are appended to sponsor-submissions.json
// (gitignored, contains PII) via lib.php's lock-guarded read-modify-write.
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

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
require __DIR__ . '/lib.php';

$SPONSOR_TYPES = [
    'premier' => 'Premier ($250)',
    'corporate' => 'Corporate ($100)',
    'individual' => 'Individual ($100)',
];
$SHIRT_SIZES = [
    "Men's Small", "Men's Medium", "Men's Large", "Men's Extra Large", "Men's 2XL", "Men's 3XL",
    "Women's Small", "Women's Medium", "Women's Large", "Women's Extra Large", "Women's 2XL", "Women's 3XL",
];

$errors = [];
$submitted = false;
$values = [
    'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
    'website' => '', 'etccMember' => false, 'sponsorType' => 'premier', 'shirtSize' => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (['name', 'contactPerson', 'phone', 'email', 'address', 'website'] as $f) {
        $values[$f] = trim((string)($_POST[$f] ?? ''));
    }
    $values['etccMember'] = !empty($_POST['etccMember']);
    $values['sponsorType'] = (string)($_POST['sponsorType'] ?? '');
    $values['shirtSize'] = (string)($_POST['shirtSize'] ?? '');

    if ($values['name'] === '') $errors[] = 'Sponsor Name is required.';
    if (!array_key_exists($values['sponsorType'], $SPONSOR_TYPES)) $errors[] = 'Choose a valid sponsor type.';
    if ($values['shirtSize'] !== '' && !in_array($values['shirtSize'], $SHIRT_SIZES, true)) $errors[] = 'Choose a valid T-shirt size.';

    if (!$errors) {
        $record = [
            'id' => 'web' . str_replace('.', '', uniqid('', true)),
            'name' => $values['name'],
            'contactPerson' => $values['contactPerson'],
            'phone' => $values['phone'],
            'email' => $values['email'],
            'address' => $values['address'],
            'website' => $values['website'],
            'etccMember' => $values['etccMember'],
            'sponsorType' => $values['sponsorType'],
            'shirtSize' => $values['shirtSize'],
            'submittedAt' => gmdate('c'),
        ];
        $file = __DIR__ . '/sponsor-submissions.json';
        if (carshow_append_json_list($file, $record)) {
            $submitted = true;
            $values = [
                'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
                'website' => '', 'etccMember' => false, 'sponsorType' => 'premier', 'shirtSize' => '',
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
      <div class="form-row checkbox-row">
        <input type="checkbox" id="f-member" name="etccMember" value="1" <?php echo $values['etccMember'] ? 'checked' : ''; ?>>
        <label for="f-member">I am an ETCC member</label>
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
      <button type="submit" class="btn">Submit Sponsorship</button>
    </form>
  <?php endif; ?>
  </div>
  <div class="footer">&copy; 2026 East Tennessee Corvette Club &middot; Knoxville, TN &middot; etccwebsite.webmanager@gmail.com</div>
</div>
</body>
</html>
