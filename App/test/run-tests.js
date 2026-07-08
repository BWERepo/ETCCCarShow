/* Node regression test against a frozen synthetic fixture (test/fixtures/*.csv).
 * Fabricated data, not real member info — safe to keep in the repo. See
 * fixtures for the scenario: a judged member (Alice) with a free + paid shirt,
 * a non-member (Bob) with no year/club, and a cancelled sponsor (Sponsor) whose
 * Individual Sponsorship activity grants a bonus free shirt from a different
 * column. Never point this at the live Exports folder — it gets overwritten by
 * every real /export-carshow-data run, which broke these assertions once already. */
var fs = require("fs");
var path = require("path");
var Papa = require("papaparse");
require("../src/config.js");            // defines globalThis.CarShowConfig
var logic = require("../src/logic.js");

var FIXTURES = path.join(__dirname, "fixtures");
var REG = path.join(FIXTURES, "registration.csv");
var ACT = path.join(FIXTURES, "activity.csv");

function parse(file) {
  var txt = fs.readFileSync(file, "utf8");
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
}

var fails = 0, passes = 0;
function eq(actual, expected, label) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passes++; console.log("  PASS " + label); }
  else { fails++; console.log("  FAIL " + label + "  expected=" + JSON.stringify(expected) + " got=" + JSON.stringify(actual)); }
}

var reg = parse(REG), act = parse(ACT);
var out = logic.generate(reg, act, { regFileName: "registration.csv", actFileName: "activity.csv" });

console.log("Fixture assertions:");
eq(out.ok, true, "generate ok");
eq(out.meta.errorCount, 0, "zero errors");
eq(out.summary.registrations, 28, "Registrations = 28");
eq(out.summary.attendees, 3, "Attendees = 3");
eq(out.summary.funds, 245, "Funds = 245");
eq(out.summary.nextMemberNumber, 8027, "Next member # = 8027");

var s = out.summary.shirtTotals;
eq(s.MensFreeSM, 1, "Men's Free SM = 1 (sponsorship bonus shirt)");
eq(s.MensFreeLG, 1, "Men's Free LG = 1 (Bob's free shirt)");
eq(s.MensFreeXLG, 1, "Men's Free XLG = 1 (Sponsor's own free shirt)");
eq(s.WomensFreeMED, 1, "Women's Free MED = 1 (Alice's free shirt)");
eq(s.WomensXtraSM, 1, "Women's Xtra SM = 1 (Alice's paid additional shirt)");
var nonZero = Object.keys(s).filter(function (k) { return s[k] !== 0; }).sort();
eq(nonZero, ["MensFreeSM", "MensFreeLG", "MensFreeXLG", "WomensFreeMED", "WomensXtraSM"].sort(), "only those 5 shirt buckets non-zero");

var c6 = out.summary.gens.filter(function (g) { return g.gen === "C6"; })[0];
eq(c6.atEvent, 1, "C6 At Event = 1 (Alice, 2010)");
eq(c6.inCarShow, 1, "C6 In Car Show = 1 (Alice judged Yes)");
var c8 = out.summary.gens.filter(function (g) { return g.gen === "C8"; })[0];
eq(c8.atEvent, 1, "C8 At Event = 1 (Sponsor, 2022)");
eq(c8.inCarShow, 0, "C8 In Car Show = 0 (Sponsor judged No)");
var otherGensNonZero = out.summary.gens.filter(function (g) { return g.gen !== "C6" && g.gen !== "C8" && (g.atEvent || g.inCarShow); });
eq(otherGensNonZero.length, 0, "no other generations populated");

eq(out.summary.clubs, [{ name: "Sample Club", attendees: 2 }, { name: "Unknown", attendees: 1 }], "club tally");
eq(out.messages.length, 0, "no messages — sponsorship handled without warning");

// table content
eq(out.registrations.length, 28, "28 table rows");
var walkins = out.registrations.filter(function (r) { return r._isWalkIn; });
eq(walkins.length, 25, "25 walk-in rows");
var alice = out.registrations.filter(function (r) { return r["First Name"] === "Alice"; })[0];
eq(alice["Member Number"], 100, "Alice keeps her own member #");
eq(alice["Phone"], "(555) 555-0100", "Alice phone formatted");
eq(alice["Gen"], "C6", "Alice gen C6");
eq(alice["In Car Show?"], "Yes", "Alice In Car Show? = Yes");
var bob = out.registrations.filter(function (r) { return r["First Name"] === "Bob"; })[0];
eq(bob["Member Number"], 8001, "Bob (non-member) assigned 8001");
var sponsor = out.registrations.filter(function (r) { return r["First Name"] === "Sponsor"; })[0];
eq(sponsor["Status"], "Cancelled", "Sponsor row kept (showCancelled=true)");
eq(Number(sponsor["Total Fee"]), 140, "Sponsor fee = 140");
eq(Number(sponsor["Individual Sponsorship"]), 100, "Sponsor's Individual Sponsorship column = 100");
eq(alice["Individual Sponsorship"], "", "Alice (no sponsorship activity) has blank Individual Sponsorship");
eq(out.summary.sponsorship, 100, "summary.sponsorship = 100");

// walk-in numbering range 8002..8026
var walkNums = walkins.map(function (r) { return r["Member Number"]; }).sort(function (a, b) { return a - b; });
eq(walkNums[0], 8002, "first walk-in # 8002");
eq(walkNums[walkNums.length - 1], 8026, "last walk-in # 8026");

// sorted by Last Name ascending, walk-ins last (all three fixture rows share Last Name "Sample")
eq(out.registrations[0]["Last Name"], "Sample", "first row sorts to Sample");
eq(/^z-> Walk-In/.test(out.registrations[out.registrations.length - 1]["Last Name"]), true, "walk-ins last");

// ---- Excel export round-trip (ExcelJS in Node) ----
var ExcelJS = require("exceljs");
var excel = require("../src/excel.js");
(async function () {
  console.log("\nExcel export round-trip:");
  var wb = excel.build(ExcelJS, out);
  var buf = await wb.xlsx.writeBuffer();
  var wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  var reg = wb2.getWorksheet("RegistrationSheet");
  var sum = wb2.getWorksheet("SummarySheet");
  eq(!!reg, true, "RegistrationSheet exists");
  eq(!!sum, true, "SummarySheet exists");
  eq(reg.getCell(1, 1).value, out.meta.title, "title row A1");
  eq(reg.getCell(2, 1).value, "Last Name", "header A2 = Last Name");
  // rows = 1 title + 1 header + 28 data
  eq(reg.actualRowCount, 30, "reg sheet has 30 rows");
  eq(!!reg.autoFilter, true, "autofilter set");
  eq(reg.views[0].state, "frozen", "frozen panes");
  // find Total Fee column, confirm a $ number format exists somewhere in it
  var feeCol = out.columns.indexOf("Total Fee") + 1;
  var sawMoney = false;
  reg.eachRow(function (row) { var c = row.getCell(feeCol); if (c.numFmt && /\$/.test(c.numFmt)) sawMoney = true; });
  eq(sawMoney, true, "Total Fee column has $ number format");
  // Excel export keeps all 24 individual shirt columns (unlike the app's collapsed UI column)
  var shirtColsInExcel = out.shirtColumns.filter(function (c) { return out.columns.indexOf(c) !== -1; });
  eq(shirtColsInExcel.length, 24, "Excel export still has all 24 shirt columns");

  console.log("\n" + passes + " passed, " + fails + " failed");
  process.exit(fails ? 1 : 0);
})();
