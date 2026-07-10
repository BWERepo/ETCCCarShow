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
// this one, has already run) sees window.__carshowLive already set.
$liveFlagScript = "<script>window.__carshowLive = { sponsorsApiUrl: \"sponsor-submissions.php\" };</script>\n";
$bundle = str_replace('<head>', '<head>' . "\n" . $liveFlagScript, $bundle);

$bootParts = [];

// Sponsors MUST be ingested before registrations: ingesting registrations
// triggers app.js's CSV -> Sponsors-tab auto-sync (any registrant with an
// Individual Sponsorship fee gets added as a sponsor if not already
// present), and that check needs the real current sponsor list already in
// state.sponsors — otherwise it would run against an empty list and
// re-upsert (overwriting) entries that already exist on the server.
$sponsors = carshow_read_json_list(__DIR__ . '/sponsor-submissions.json');
$bootParts[] = "    window.__carshow.ingestSponsors(" . carshow_safe_inline_json($sponsors) . ");\n";

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
