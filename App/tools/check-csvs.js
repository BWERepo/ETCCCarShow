/* Ad-hoc sanity check for a real pair of ClubExpress CSVs — NOT part of the
 * automated test suite (that stays on the frozen synthetic fixture in
 * test/fixtures/). Useful when spot-checking a live export before/after a
 * config.js change, e.g. after adding a new activityTitleToBucket mapping.
 * Usage: node tools/check-csvs.js <registration.csv> <activity.csv> */
var fs = require("fs");
var path = require("path");
var Papa = require("papaparse");
require("../src/config.js");
var logic = require("../src/logic.js");

var regFile = process.argv[2], actFile = process.argv[3];
if (!regFile || !actFile) {
  console.error("Usage: node tools/check-csvs.js <registration.csv> <activity.csv>");
  process.exit(1);
}

function parse(f) { return Papa.parse(fs.readFileSync(f, "utf8"), { header: true, skipEmptyLines: true }).data; }
var reg = parse(regFile), act = parse(actFile);
var out = logic.generate(reg, act, { regFileName: path.basename(regFile), actFileName: path.basename(actFile) });

console.log("Summary:", JSON.stringify(out.summary, null, 2));
console.log("Messages:", out.messages);
var real = out.registrations.filter(function (r) { return !r._isWalkIn; });
console.log("\nReal registration rows (" + real.length + "):");
real.forEach(function (r) {
  console.log(" -", r["Last Name"], r["First Name"], "| Member#", r["Member Number"], "| Status", r["Status"], "| Fee", r["Total Fee"]);
});
