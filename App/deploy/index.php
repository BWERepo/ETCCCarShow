<?php
session_start();

// Belt-and-suspenders against browser/proxy caching of the gate itself —
// this page's content depends on session state AND on server-side data that
// can change between requests (registrations-upload.php,
// sponsor-submissions.php), so a cached copy is always liable to be wrong.
// Relying on PHP's default session cache limiter wasn't enough on this host.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// $PASSWORD_HASH is defined in secrets.php (gitignored, not committed — see
// secrets.example.php for the template). Generate a new hash with:
//   openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'
// crypt() verifies SHA-512-crypt ($6$) hashes natively, no PHP needed locally.
require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

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
    readfile(__DIR__ . '/_login.html');
    exit;
}

header('Content-Type: text/html; charset=utf-8');

// app-bundle.html is a plain copy of the built ETCCCarShow.html, uploaded by
// ftp-deploy.sh whenever App/src/ changes — unlike the old _data.html, it
// carries NO baked-in data. Registration/activity CSVs and the sponsor list
// are stitched in fresh below on every request, so a
// registrations-upload.php upload or a sponsor-submissions.php edit is live
// for the very next page load with no rebuild/redeploy step. See README.md.
$bundle = @file_get_contents(__DIR__ . '/app-bundle.html');
if ($bundle === false) {
    http_response_code(500);
    echo 'app-bundle.html is missing on the server — run deploy/ftp-deploy.sh (after node build.js) to upload it.';
    exit;
}

// Must run BEFORE the bundled app.js so its init() (which fires on
// DOMContentLoaded — after every inline script in the document, including
// this one, has already run) sees window.__carshowSite already set.
$siteConfigScript = "<script>window.__carshowSite = { sponsorsApiUrl: \"sponsor-submissions.php\", walkinsApiUrl: \"walkin-registrations.php\", appSettingsApiUrl: \"app-settings.php\", deletedRegistrationsApiUrl: \"deleted-registrations.php\", registrationOverridesApiUrl: \"registration-overrides.php\", paidRegistrationsCacheApiUrl: \"paid-registrations-cache.php\", windowCardPdfApiUrl: \"window-card-pdf.php\", sendTshirtOrderEmailApiUrl: \"send-tshirt-order-email.php\", sponsorPaymentsApiUrl: \"sponsor-payments.php\", tshirtPurchasesApiUrl: \"tshirt-purchases.php\" };</script>\n";
$bundle = str_replace('<head>', '<head>' . "\n" . $siteConfigScript, $bundle);

$bootParts = [];

// Sponsors MUST be ingested before registrations: ingesting registrations
// triggers app.js's CSV -> Sponsors-tab auto-sync (any registrant with an
// Individual Sponsorship fee gets added as a sponsor if not already
// present), and that check needs the real current sponsor list already in
// state.sponsors — otherwise it would run against an empty list and
// re-upsert (overwriting) entries that already exist on the server.
$sponsors = carshow_read_json_list(__DIR__ . '/sponsor-submissions.json');
$bootParts[] = "    window.__carshow.ingestSponsors(" . carshow_safe_inline_json($sponsors) . ");\n";

// Payments (Cash/Check/Credit Card records against a sponsor) — ingested
// right after sponsors so backfillPaymentDefaults() (triggered inside
// ingestPayments) sees the real current sponsor list, not an empty one.
$payments = carshow_read_json_list(__DIR__ . '/sponsor-payments.json');
$bootParts[] = "    window.__carshow.ingestPayments(" . carshow_safe_inline_json($payments) . ");\n";

// Walk-In registrations are independent of the CSV-derived data below —
// they survive a fresh CSV import, unlike registrations-data.json — so
// ingestion order relative to it doesn't matter, unlike sponsors above.
$walkins = carshow_read_json_list(__DIR__ . '/walkin-registrations.json');
$bootParts[] = "    window.__carshow.ingestWalkins(" . carshow_safe_inline_json($walkins) . ");\n";

// Day-of-event t-shirt purchases (T-Shirts tab > 🛒 Buy T-Shirt) — independent
// of everything else, just read fresh on every page load.
$tshirtPurchases = carshow_read_json_list(__DIR__ . '/tshirt-purchases.json');
$bootParts[] = "    window.__carshow.ingestTshirtPurchases(" . carshow_safe_inline_json($tshirtPurchases) . ");\n";

// Member roster (name + member number, if the last CSV import had that
// column — see members-import.php) — used by the Add Registration form to
// look up a Walk-In Member's number by name.
$members = carshow_read_json_list(__DIR__ . '/members-data.json');
$bootParts[] = "    window.__carshow.ingestMembers(" . carshow_safe_inline_json($members) . ");\n";

// App-wide settings — defaults here MUST match app-settings.php's $defaults.
$appSettingsFile = __DIR__ . '/app-settings.json';
$appSettingsRaw = is_file($appSettingsFile) ? json_decode(file_get_contents($appSettingsFile), true) : [];
$appSettingsDefaults = [
    'walkinFirstNonMember' => 2000,
    'walkInCarShowFee' => 50,
    'walkInNonCarShowFee' => 0,
    'preregistrationFee' => 40,
    'windowCardPdf' => '',
    'tshirtVendorEmail' => '',
    'tshirtEventPurchaseCost' => 0,
    'sponsorEmailTo' => '',
    'sponsorEmailCc' => '',
    'sponsorEmailBcc' => '',
    'sponsorEmailSubject' => 'New Sponsor Submission'
];
$appSettings = array_merge($appSettingsDefaults, is_array($appSettingsRaw) ? $appSettingsRaw : []);
// externalApiKey has no static default above — this file is committed to a
// public repo, so a hardcoded key would be visible to anyone. Generate one
// at random the first time it's missing and persist it immediately, so it's
// stable from then on (app-settings.php's own `get` action does the same
// thing, for whichever of the two runs first on a fresh deploy).
if (empty($appSettings['externalApiKey'])) {
    $appSettings['externalApiKey'] = bin2hex(random_bytes(16));
    carshow_write_json($appSettingsFile, $appSettings);
}
$bootParts[] = "    window.__carshow.ingestAppSettings(" . carshow_safe_inline_json($appSettings) . ");\n";

// MUST run before the ingestRows() call below — regenerate() (triggered by
// ingestRows) excludes deleted keys from the freshly-parsed CSV the moment
// it runs, not just after the fact.
$deletedKeys = carshow_read_json_list(__DIR__ . '/deleted-registrations.json');
$bootParts[] = "    window.__carshow.ingestDeletedRegistrations(" . carshow_safe_inline_json($deletedKeys) . ");\n";

// Same ordering requirement as deleted-registrations above — regenerate()
// applies these field-edit patches to the freshly-parsed CSV rows immediately.
$overridesRaw = is_file(__DIR__ . '/registration-overrides.json') ? json_decode(file_get_contents(__DIR__ . '/registration-overrides.json'), true) : [];
$overrides = is_array($overridesRaw) ? $overridesRaw : [];
$bootParts[] = "    window.__carshow.ingestRegistrationOverrides(" . carshow_safe_inline_json($overrides) . ");\n";

$regFile = __DIR__ . '/registrations-data.json';
if (is_file($regFile)) {
    $reg = json_decode(file_get_contents($regFile), true);
    if (is_array($reg) && !empty($reg['regCsv'])) {
        $bootParts[] =
            "    var REG_CSV = " . carshow_safe_inline_json($reg['regCsv']) . ";\n" .
            "    var ACT_CSV = " . carshow_safe_inline_json($reg['actCsv'] ?? '') . ";\n" .
            "    var GENERATED_AT = new Date(" . (int)($reg['generatedAt'] ?? 0) . ");\n" .
            "    var regRows = Papa.parse(REG_CSV, { header: true, skipEmptyLines: true }).data;\n" .
            "    var actRows = ACT_CSV ? Papa.parse(ACT_CSV, { header: true, skipEmptyLines: true }).data : [];\n" .
            "    window.__carshow.ingestRows(regRows, actRows, GENERATED_AT);\n";
    }
}

$bootScript = "\n<script>\n(function(){\n  function boot(){\n" . implode('', $bootParts) .
    "  }\n  if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", boot);\n  else boot();\n})();\n</script>\n";
$bundle = str_replace('</body>', $bootScript . '</body>', $bundle);

echo $bundle;
