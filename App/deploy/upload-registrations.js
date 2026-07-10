// Uploads the newest exported CSVs straight to the live site's
// registrations-upload.php, so the hosted page (etccapps.com) reflects them
// on the very next load. Replaces the old build-snapshot.js + ftp-deploy.sh
// dance for a pure DATA refresh — code changes (App/src/*) still go out via
// `node build.js` + `ftp-deploy.sh` as before, since those change
// app-bundle.html, not the data.
//
// Usage:
//   CARSHOW_SITE_PASSWORD=... node deploy/upload-registrations.js [regCsvPath] [actCsvPath] [url]
// With no path args, picks the newest registration_data*.csv /
// activity_registrant_data*.csv in the Exports folder, same as
// build-snapshot.js did.
var fs = require("fs");
var path = require("path");
var https = require("https");

var EXPORTS_DIR = "Z:\\Backup\\ETCC\\Car Show\\Exports";
var DEFAULT_URL = "https://etccapps.com/apps/carshow/registrations-upload.php";

function newestMatching(dir, prefix) {
  var files = fs.readdirSync(dir)
    .filter(function (f) { return f.indexOf(prefix) === 0 && f.endsWith(".csv"); })
    .map(function (f) { return { name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }; })
    .sort(function (a, b) { return b.mtime - a.mtime; });
  if (!files.length) throw new Error("No " + prefix + "*.csv found in " + dir);
  return path.join(dir, files[0].name);
}

var regCsvPath = process.argv[2] || newestMatching(EXPORTS_DIR, "registration_data");
var actCsvPath = process.argv[3] || newestMatching(EXPORTS_DIR, "activity_registrant_data");
var url = process.argv[4] || DEFAULT_URL;
var password = process.env.CARSHOW_SITE_PASSWORD;

if (!password) {
  console.error("Set CARSHOW_SITE_PASSWORD to the site's login password before running this.");
  process.exit(1);
}

var regCsv = fs.readFileSync(regCsvPath, "utf8");
var actCsv = fs.readFileSync(actCsvPath, "utf8");

// Same "when was this actually exported" logic build-snapshot.js used —
// the newer of the two files' mtimes, not upload time.
var generatedAtMs = Math.max(fs.statSync(regCsvPath).mtimeMs, fs.statSync(actCsvPath).mtimeMs);

var payload = JSON.stringify({ regCsv: regCsv, actCsv: actCsv, generatedAt: generatedAtMs, password: password });
var u = new URL(url);

var req = https.request({
  hostname: u.hostname,
  path: u.pathname + u.search,
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
}, function (res) {
  var body = "";
  res.on("data", function (chunk) { body += chunk; });
  res.on("end", function () {
    console.log("Status: " + res.statusCode);
    console.log(body);
    console.log("Uploaded from:");
    console.log("  " + regCsvPath);
    console.log("  " + actCsvPath);
    console.log("CSVs loaded time will show: " + new Date(generatedAtMs).toString());
    if (res.statusCode !== 200) process.exitCode = 1;
  });
});
req.on("error", function (err) {
  console.error("Upload failed:", err.message);
  process.exitCode = 1;
});
req.write(payload);
req.end();
