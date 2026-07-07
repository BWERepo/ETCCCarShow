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
scripts.map(function (s) { return '<script>\n' + s + '\n</script>'; }).join("\n") +
'\n</body>\n</html>\n';

var out = process.argv[2] || path.join(HERE, "ETCCCarShow.html");
fs.writeFileSync(out, html);
var kb = Math.round(Buffer.byteLength(html) / 1024);
console.log("Wrote " + out + " (" + kb + " KB)");
