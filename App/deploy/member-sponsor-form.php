<?php
// Sponsor sign-up form for ETCC members (renamed from sponsor-form.php to
// member-sponsor-form.php once a non-member variant, public-sponsor-form.php,
// was created alongside it — this is the one requiring ETCC Member Name /
// Member Email; that variant has neither). Public, no password gate
// (removed; this page is meant to be linked/embedded from another website
// for sponsors/businesses to fill out directly, with no site password to
// hand out). Submissions are appended to sponsor-submissions.json
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
//
// ETCC Member Name is a required free-text field constrained by a <datalist>
// and validated server-side against members-data.json (imported via
// members-import.php from a club membership CSV) — not a boolean checkbox.
// It must match the roster exactly (case-insensitively) or the submission
// is rejected.

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

// Member roster (gitignored, contains member PII — see members-import.php)
// used only to populate the datalist suggestions and validate the ETCC
// Member Name field below. Blocked from direct HTTP access by .htaccess.
$members = carshow_read_json_list(__DIR__ . '/members-data.json');
$memberNames = []; // lowercased name -> canonical display name, for case-insensitive validation
$memberEmails = []; // canonical display name -> email, for the "Member Email" auto-fill below
foreach ($members as $m) {
    if (!empty($m['name'])) {
        $memberNames[strtolower($m['name'])] = $m['name'];
        if (!empty($m['email'])) $memberEmails[$m['name']] = $m['email'];
    }
}

$errors = [];
$success = false;
$values = [
    'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
    'website' => '', 'etccMemberName' => '', 'memberEmail' => '', 'sponsorType' => 'premier', 'shirtSize' => '',
];
// See the post-submit redirect below for what this actually controls —
// carried as a hidden form field (not just the URL's query string) so it
// survives a validation-error re-render too.
$fromParam = (string)($_POST['from'] ?? ($_GET['from'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (['name', 'contactPerson', 'phone', 'email', 'address', 'website', 'etccMemberName', 'memberEmail'] as $f) {
        $values[$f] = trim((string)($_POST[$f] ?? ''));
    }
    $values['sponsorType'] = (string)($_POST['sponsorType'] ?? '');
    $values['shirtSize'] = (string)($_POST['shirtSize'] ?? '');

    if ($values['name'] === '') $errors[] = 'Sponsor Name is required.';
    if (!array_key_exists($values['sponsorType'], $SPONSOR_TYPES)) $errors[] = 'Choose a valid sponsor type.';
    if ($values['shirtSize'] !== '' && !in_array($values['shirtSize'], $SHIRT_SIZES, true)) $errors[] = 'Choose a valid T-shirt size.';
    if ($values['etccMemberName'] === '') {
        $errors[] = 'ETCC Member Name is required.';
    } else {
        $matched = $memberNames[strtolower($values['etccMemberName'])] ?? null;
        if ($matched === null) {
            $errors[] = 'ETCC Member Name not found in the roster — pick a name from the suggestions.';
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
            'memberEmail' => $values['memberEmail'],
            'sponsorType' => $values['sponsorType'],
            'shirtSize' => $values['shirtSize'],
            'submittedAt' => gmdate('c'),
        ];
        $file = __DIR__ . '/sponsor-submissions.json';
        if (carshow_append_json_list($file, $record)) {
            // Email a copy of this submission, in addition to the JSON save
            // above, if configured (Developer > Settings > New Sponsor
            // Confirmation Email). Best-effort — a failed send never blocks
            // or fails the actual submission.
            try {
                // app-settings.json is a JSON object (not a list), so read it
                // directly rather than via carshow_read_json_list().
                $rawSettings = is_file(__DIR__ . '/app-settings.json') ? json_decode(file_get_contents(__DIR__ . '/app-settings.json'), true) : [];
                $s = is_array($rawSettings) ? $rawSettings : [];
                // Settings > New Sponsor Confirmation Email's "To" is the override;
                // if it's left blank, default to the member's own email from this
                // submission instead of not sending at all.
                $emailTo = trim((string)($s['sponsorEmailTo'] ?? ''));
                if ($emailTo === '') $emailTo = $record['memberEmail'];
                $emailCc = trim((string)($s['sponsorEmailCc'] ?? ''));
                $emailBcc = trim((string)($s['sponsorEmailBcc'] ?? ''));
                $emailSubject = trim((string)($s['sponsorEmailSubject'] ?? '')) ?: 'New Sponsor Submission';
                if ($emailTo !== '' && carshow_parse_addr_list($emailTo)) {
                    $logoUrl = 'https://etccapps.com/apps/carshow/ETCClogoWhiteBackground.png';
                    $rows = [
                        'Sponsor Type'     => $SPONSOR_TYPES[$record['sponsorType']] ?? $record['sponsorType'],
                        'Sponsor Name'     => $record['name'],
                        'ETCC Member Name' => $record['etccMemberName'],
                        'Member Email'     => $record['memberEmail'],
                        'Contact Person'   => $record['contactPerson'],
                        'Phone'            => $record['phone'],
                        'Email'            => $record['email'],
                        'Address'          => $record['address'],
                        'Website'          => $record['website'],
                        'T-Shirt Size'     => $record['shirtSize'],
                    ];
                    $rowsHtml = '';
                    foreach ($rows as $label => $value) {
                        if ($value === '' || $value === null) continue;
                        $rowsHtml .= '<tr>'
                            . '<td style="padding:10px 16px;border-bottom:1px solid #e3e6ea;color:#667085;font-size:13px;font-weight:600;white-space:nowrap;vertical-align:top;">' . htmlspecialchars($label) . '</td>'
                            . '<td style="padding:10px 16px;border-bottom:1px solid #e3e6ea;color:#1a1a1a;font-size:13px;">' . nl2br(htmlspecialchars((string)$value)) . '</td>'
                            . '</tr>';
                    }
                    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
                        . '<body style="margin:0;padding:0;background:#f4f6f8;font-family:\'Segoe UI\',Arial,sans-serif;">'
                        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:28px 16px;">'
                        . '<tr><td align="center">'
                        . '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e3e6ea;overflow:hidden;">'
                        . '<tr><td style="padding:28px 24px 8px;text-align:center;">'
                        . '<img src="' . htmlspecialchars($logoUrl) . '" alt="ETCC Logo" width="64" height="64" style="display:block;margin:0 auto 12px;border-radius:6px;">'
                        . '<div style="font-size:20px;font-weight:700;color:#1a1a1a;">New Sponsor Submitted</div>'
                        . '<div style="font-size:13px;color:#667085;margin-top:2px;">East Tennessee Corvette Club Car Show</div>'
                        . '</td></tr>'
                        . '<tr><td style="padding:16px 24px 4px;">'
                        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e6ea;border-radius:8px;overflow:hidden;">' . $rowsHtml . '</table>'
                        . '</td></tr>'
                        . '<tr><td style="padding:20px 24px 24px;text-align:center;color:#667085;font-size:11px;">'
                        . '&copy; 2026 East Tennessee Corvette Club &middot; Knoxville, TN'
                        . '</td></tr>'
                        . '</table></td></tr></table></body></html>';
                    carshow_send_mail($emailTo, $emailSubject, $html, $emailCc, $emailBcc, true);
                }
            } catch (Exception $e) { /* email is best-effort, submission already succeeded */ }

            // No payment is ever recorded from this form — a sponsorship
            // submitted here isn't actually paid yet; an officer records the
            // real payment later from the Sponsors tab's "Mark Paid…" modal.
            // Stay on this same form after a successful submission (rather
            // than redirecting away) so an officer can add several sponsors
            // back to back without re-navigating here each time — show a
            // confirmation banner and reset every field back to its default.
            $success = true;
            $values = [
                'name' => '', 'contactPerson' => '', 'phone' => '', 'email' => '', 'address' => '',
                'website' => '', 'etccMemberName' => '', 'memberEmail' => '', 'sponsorType' => 'premier', 'shirtSize' => '',
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
  .success { background:#f0faf3; border-left:4px solid var(--good); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--good); font-size:13px; font-weight:600; }
  .footer { text-align:center; color:var(--muted); font-size:11px; margin-top:22px; }
</style>
</head>
<body>
<div class="wrap">
  <img src="ETCClogoWhiteBackground.png" alt="ETCC Logo" class="logo">
  <h1>Become a Car Show Sponsor</h1>
  <div class="sub">East Tennessee Corvette Club - Member Version</div>
  <div class="panel">
    <?php if ($success): ?>
      <div class="success">Thanks! The sponsorship was submitted successfully. You can add another below.</div>
    <?php endif; ?>
    <?php if ($errors): ?>
      <div class="errors"><strong>Please fix the following:</strong><ul>
        <?php foreach ($errors as $e) echo '<li>' . htmlspecialchars($e) . '</li>'; ?>
      </ul></div>
    <?php endif; ?>
    <form method="post" novalidate>
      <input type="hidden" name="from" value="<?php echo htmlspecialchars($fromParam); ?>">
      <div class="form-row">
        <label for="f-type">Sponsor Type *</label>
        <select id="f-type" name="sponsorType">
          <?php foreach ($SPONSOR_TYPES as $key => $label): ?>
            <option value="<?php echo htmlspecialchars($key); ?>" <?php echo $values['sponsorType'] === $key ? 'selected' : ''; ?>><?php echo htmlspecialchars($label); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-row">
        <label for="f-name">Sponsor Name * <small style="font-weight:normal;color:var(--muted)">(Will appear on shirt)</small></label>
        <input type="text" id="f-name" name="name" required value="<?php echo htmlspecialchars($values['name']); ?>">
      </div>
      <div class="form-row">
        <label for="f-member">ETCC Member Name *</label>
        <input type="text" id="f-member" name="etccMemberName" list="etcc-members" autocomplete="off" required
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
        <label for="f-member-email">Member Email</label>
        <input type="email" id="f-member-email" name="memberEmail" value="<?php echo htmlspecialchars($values['memberEmail']); ?>">
      </div>
      <script>
        (function () {
          var memberEmails = <?php echo json_encode($memberEmails); ?>;
          var nameInput = document.getElementById('f-member');
          var emailInput = document.getElementById('f-member-email');
          function fillEmail() {
            var email = memberEmails[nameInput.value];
            if (email) emailInput.value = email;
          }
          nameInput.addEventListener('input', fillEmail);
          nameInput.addEventListener('change', fillEmail);
        })();
      </script>
      <div class="form-row">
        <label for="f-contact">Contact Person</label>
        <input type="text" id="f-contact" name="contactPerson" value="<?php echo htmlspecialchars($values['contactPerson']); ?>">
      </div>
      <div class="form-row">
        <label for="f-phone">Phone</label>
        <input type="tel" id="f-phone" name="phone" placeholder="(123) 456-7890" value="<?php echo htmlspecialchars($values['phone']); ?>">
      </div>
      <script>
        (function () {
          var phoneInput = document.getElementById('f-phone');
          function formatPhone(v) {
            var digits = v.replace(/\D/g, '').slice(0, 10);
            if (digits.length < 4) return digits;
            if (digits.length < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
            return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
          }
          phoneInput.addEventListener('input', function () { phoneInput.value = formatPhone(phoneInput.value); });
          phoneInput.value = formatPhone(phoneInput.value);
        })();
      </script>
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
        <label for="f-shirt">T-Shirt Size</label>
        <select id="f-shirt" name="shirtSize">
          <option value="">— none —</option>
          <?php foreach ($SHIRT_SIZES as $sz): ?>
            <option value="<?php echo htmlspecialchars($sz); ?>" <?php echo $values['shirtSize'] === $sz ? 'selected' : ''; ?>><?php echo htmlspecialchars($sz); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <?php $cancelUrl = $fromParam === 'app' ? 'index.php#sponsors' : 'https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652'; ?>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" onclick="location.href='<?php echo htmlspecialchars($cancelUrl, ENT_QUOTES); ?>'">Done</button>
        <button type="submit" class="btn">Submit Sponsorship</button>
      </div>
    </form>
  </div>
  <div class="footer">&copy; 2026 East Tennessee Corvette Club &middot; Knoxville, TN &middot; <a href="mailto:etccwebsite.webmanager@gmail.com">etccwebsite.webmanager@gmail.com</a></div>
</div>
</body>
</html>
