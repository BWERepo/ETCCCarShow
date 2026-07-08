// Builds deploy/_data.html: a copy of the built ETCCCarShow.html with the two
// current CSVs embedded and auto-ingested on load (via window.__carshow.ingestRows),
// so index.php can serve it straight to an authenticated session with no
// drop-zone step. Run after `node build.js` in App/ so ETCCCarShow.html is current.
//
// Usage: node deploy/build-snapshot.js [regCsvPath] [actCsvPath]
// With no args, picks the newest registration_data*.csv / activity_registrant_data*.csv
// in the Exports folder.
var fs = require("fs");
var path = require("path");

var EXPORTS_DIR = "Z:\\Backup\\ETCC\\Car Show\\Exports";
var HTML_SRC = path.join(__dirname, "..", "ETCCCarShow.html");
var OUT = path.join(__dirname, "_data.html");

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

var html = fs.readFileSync(HTML_SRC, "utf8");
var regCsv = fs.readFileSync(regCsvPath, "utf8");
var actCsv = fs.readFileSync(actCsvPath, "utf8");

// "CSVs loaded:" should show when these exports actually happened, not
// whenever a visitor's browser happens to load the page (the boot script
// below re-ingests on every page view) — use the newer of the two files'
// mtimes as the effective export time.
var generatedAtMs = Math.max(fs.statSync(regCsvPath).mtimeMs, fs.statSync(actCsvPath).mtimeMs);

// The offline-tool subtitle is accurate for ETCCCarShow.html run locally (drag
// your own CSVs in, nothing leaves your computer) but false for this hosted
// snapshot, which ships pre-loaded data over the network behind a login —
// swap it for wording that's true of *this* artifact.
var OLD_SUBTITLE = "Offline tool · your data never leaves this computer";
var NEW_SUBTITLE = "Hosted snapshot · view only, password-protected";
if (html.indexOf(OLD_SUBTITLE) === -1) throw new Error("Could not find subtitle text to replace in " + HTML_SRC);
html = html.replace(OLD_SUBTITLE, NEW_SUBTITLE);

// JSON.stringify safely escapes quotes/backslashes/newlines; also guard the
// two line-terminator code points (U+2028, U+2029) that JSON leaves
// unescaped but that older JS engines choke on inside string literals.
function jsStringLiteral(s) {
  var LS = String.fromCharCode(0x2028);
  var PS = String.fromCharCode(0x2029);
  return JSON.stringify(s).split(LS).join("\\u2028").split(PS).join("\\u2029");
}

var snapshotScript = "\n<script>\n" +
  "(function(){\n" +
  "  var REG_CSV = " + jsStringLiteral(regCsv) + ";\n" +
  "  var ACT_CSV = " + jsStringLiteral(actCsv) + ";\n" +
  "  var GENERATED_AT = new Date(" + generatedAtMs + ");\n" +
  "  function boot(){\n" +
  "    var reg = Papa.parse(REG_CSV, { header: true, skipEmptyLines: true }).data;\n" +
  "    var act = Papa.parse(ACT_CSV, { header: true, skipEmptyLines: true }).data;\n" +
  "    window.__carshow.ingestRows(reg, act, GENERATED_AT);\n" +
  "  }\n" +
  "  if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", boot);\n" +
  "  else boot();\n" +
  "})();\n" +
  "</script>\n";

if (html.indexOf("</body>") === -1) throw new Error("Could not find </body> in " + HTML_SRC);
var out = html.replace("</body>", snapshotScript + "</body>");
fs.writeFileSync(OUT, out, "utf8");
console.log("Wrote " + OUT + " (" + (out.length / 1024 / 1024).toFixed(2) + " MB) from:");
console.log("  " + regCsvPath);
console.log("  " + actCsvPath);
console.log("CSVs loaded time will show: " + new Date(generatedAtMs).toString());
