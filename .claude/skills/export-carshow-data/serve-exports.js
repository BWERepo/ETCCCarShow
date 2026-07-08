/* Static file server for Z:\Backup\ETCC\Car Show\Exports — used only by the
 * export-carshow-data skill to hand today's two CSVs to the app via fetch()
 * instead of hand-copying their content into a JS injection (which silently
 * corrupted a row once — see "Loading data into the app" in SKILL.md).
 *
 * Deliberately lives here, NOT under App/, and NEVER writes Exports data into
 * App/ — App/ is a git repo pushed to GitHub, and Exports contains real
 * member PII (names, emails, phones, addresses) that must never be copied
 * into it, even temporarily.
 *
 * Usage: node serve-exports.js [port]  (defaults to 5751) */
var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = Number(process.argv[2]) || 5751;
var ROOT = "Z:/Backup/ETCC/Car Show/Exports";
var APP_ORIGIN = "http://localhost:5750";

http.createServer(function (req, res) {
  var reqPath = decodeURIComponent(req.url.split("?")[0]);
  var file = path.join(ROOT, reqPath);
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": "text/csv", "Access-Control-Allow-Origin": APP_ORIGIN });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1", function () {
  console.log("Serving " + ROOT + " at http://localhost:" + PORT + "/");
});
