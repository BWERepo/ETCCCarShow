/* Minimal zero-dependency static file server for ETCCCarShow.html.
 * Exists only so browser automation (which can't navigate file:// URLs) can
 * open the app over http://localhost during the export-carshow-data skill.
 * Usage: node serve.js [port]  (defaults to 5750) */
var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = Number(process.argv[2]) || 5750;
var ROOT = __dirname;
var TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http.createServer(function (req, res) {
  var reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/ETCCCarShow.html";
  var file = path.join(ROOT, reqPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1", function () {
  console.log("Serving " + ROOT + " at http://localhost:" + PORT + "/");
});
