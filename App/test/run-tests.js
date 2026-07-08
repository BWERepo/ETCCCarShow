/* Node regression test against a frozen synthetic fixture (test/fixtures/*.csv).
 * Assertions live in ../src/regression-tests.js, shared with the in-app
 * Settings -> Run Regression Tests button so both stay in sync. Never point
 * this at the live Exports folder — it gets overwritten by every real
 * /export-carshow-data run, which broke these assertions once already. */
var fs = require("fs");
var path = require("path");
var Papa = require("papaparse");
require("../src/config.js");            // defines globalThis.CarShowConfig
require("../src/logic.js");             // defines globalThis.CarShowLogic
require("../src/excel.js");             // defines globalThis.CarShowExcel
var regressionTests = require("../src/regression-tests.js");
var ExcelJS = require("exceljs");

var FIXTURES = path.join(__dirname, "fixtures");
var REG = path.join(FIXTURES, "registration.csv");
var ACT = path.join(FIXTURES, "activity.csv");

function parse(file) {
  var txt = fs.readFileSync(file, "utf8");
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
}

var fails = 0, passes = 0;
function report(results) {
  results.forEach(function (r) {
    if (r.ok) { passes++; console.log("  PASS " + r.label); }
    else { fails++; console.log("  FAIL " + r.label + "  expected=" + JSON.stringify(r.expected) + " got=" + JSON.stringify(r.actual)); }
  });
}

var reg = parse(REG), act = parse(ACT);

console.log("Fixture assertions:");
var built = regressionTests.assertionList(reg, act);
report(built.results);

console.log("\nExcel export round-trip:");
regressionTests.excelAssertionList(built.out, ExcelJS).then(function (excelResults) {
  report(excelResults);
  console.log("\n" + passes + " passed, " + fails + " failed");
  process.exit(fails ? 1 : 0);
});
