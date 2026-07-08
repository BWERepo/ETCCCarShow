/* build.js — inline vendor + src into a single self-contained ETCCCarShow.html.
 * Usage: node build.js [outputPath]
 */
var fs = require("fs");
var path = require("path");

var HERE = __dirname;
function read(p) { return fs.readFileSync(path.join(HERE, p), "utf8"); }
// Prevent a stray "</script>" in library text from closing our script tag.
function safeJs(s) { return s.replace(/<\/script>/gi, "<\\/script>"); }

var css = read("src/styles.css");
var scripts = [
  read("vendor/papaparse.min.js"),
  read("vendor/exceljs.min.js"),
  read("src/config.js"),
  read("src/logic.js"),
  read("src/excel.js"),
  read("src/app.js")
].map(safeJs);

// --- version: starts at 1.0, bumps the minor number every time this script
// runs (each run produces the deployed ETCCCarShow.html). The stamped
// version/date are baked into the HTML at build time — not computed at page
// load — so they reflect when THIS artifact was actually built, not today.
var VERSION_PATH = path.join(HERE, "version.json");
var version = { major: 1, minor: 0 };
if (fs.existsSync(VERSION_PATH)) {
  try { version = JSON.parse(fs.readFileSync(VERSION_PATH, "utf8")); } catch (e) { /* fall back to 1.0 */ }
}
var versionString = version.major + "." + version.minor;
var deployedAt = new Date();
fs.writeFileSync(VERSION_PATH, JSON.stringify({
  major: version.major, minor: version.minor + 1, lastBuilt: deployedAt.toISOString()
}, null, 2) + "\n");

function fmtDateTime(d) {
  function p(n) { return (n < 10 ? "0" : "") + n; }
  var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + h + ":" + p(d.getMinutes()) + " " + ap;
}

var html =
'<!DOCTYPE html>\n' +
'<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>ETCC Car Show — Registration</title>\n' +
'<style>\n' + css + '\n</style>\n</head>\n<body>\n' +
'<header class="app">\n' +
'  <h1>ETCC Car Show — Registration</h1>\n' +
'  <span class="sub">Offline tool · your data never leaves this computer</span>\n' +
'</header>\n' +
'<div class="wrap">\n' +
'  <div id="drop" class="drop"></div>\n' +
'  <div id="app"></div>\n' +
'</div>\n' +
'<footer class="app-footer">\n' +
'  <div>v' + versionString + ' &middot; Deployed ' + fmtDateTime(deployedAt) + '</div>\n' +
'  <div class="footer-credit">Website by Business Web Express &middot; info@businesswebexpress.com</div>\n' +
'</footer>\n' +
scripts.map(function (s) { return '<script>\n' + s + '\n</script>'; }).join("\n") +
'\n</body>\n</html>\n';

var out = process.argv[2] || path.join(HERE, "ETCCCarShow.html");
fs.writeFileSync(out, html);
var kb = Math.round(Buffer.byteLength(html) / 1024);
console.log("Wrote " + out + " (" + kb + " KB)");
