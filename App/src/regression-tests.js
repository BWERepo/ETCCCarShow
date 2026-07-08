/* regression-tests.js — assertions against the frozen synthetic fixture,
 * shared by the Node CLI (test/run-tests.js) and the in-app Settings ->
 * Run Regression Tests button, so both stay in sync automatically instead
 * of drifting apart as two hand-copied assertion lists.
 *
 * Fixture scenario: a judged member (Alice) with a free + paid shirt, a
 * non-member (Bob) with no year/club, and a cancelled sponsor (Sponsor)
 * whose Individual Sponsorship activity grants a bonus free shirt from a
 * different column. Fabricated data, not real member info.
 */
(function (root) {
  "use strict";
  var LOGIC = root.CarShowLogic ||
    (typeof require !== "undefined" ? require("./logic.js") : null);
  var EXCEL = root.CarShowExcel ||
    (typeof require !== "undefined" ? require("./excel.js") : null);

  function eq(results, actual, expected, label) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ label: label, ok: ok, expected: expected, actual: actual });
  }

  // Logic-layer assertions (generate()) against the fixture. Returns
  // { out, results } — callers needing the Excel round-trip too pass `out`
  // into excelAssertionList so generate() only runs once.
  function assertionList(reg, act) {
    var results = [];
    var out = LOGIC.generate(reg, act, { regFileName: "registration.csv", actFileName: "activity.csv" });

    eq(results, out.ok, true, "generate ok");
    eq(results, out.meta.errorCount, 0, "zero errors");
    eq(results, out.summary.registrations, 28, "Registrations = 28");
    eq(results, out.summary.attendees, 3, "Attendees = 3");
    eq(results, out.summary.funds, 245, "Funds = 245");
    eq(results, out.summary.nextMemberNumber, 8027, "Next member # = 8027");

    var s = out.summary.shirtTotals;
    eq(results, s.MensFreeSM, 1, "Men's Free SM = 1 (sponsorship bonus shirt)");
    eq(results, s.MensFreeLG, 1, "Men's Free LG = 1 (Bob's free shirt)");
    eq(results, s.MensFreeXLG, 1, "Men's Free XLG = 1 (Sponsor's own free shirt)");
    eq(results, s.WomensFreeMED, 1, "Women's Free MED = 1 (Alice's free shirt)");
    eq(results, s.WomensXtraSM, 1, "Women's Xtra SM = 1 (Alice's paid additional shirt)");
    var nonZero = Object.keys(s).filter(function (k) { return s[k] !== 0; }).sort();
    eq(results, nonZero, ["MensFreeSM", "MensFreeLG", "MensFreeXLG", "WomensFreeMED", "WomensXtraSM"].sort(), "only those 5 shirt buckets non-zero");

    var c6 = out.summary.gens.filter(function (g) { return g.gen === "C6"; })[0];
    eq(results, c6.atEvent, 1, "C6 At Event = 1 (Alice, 2010)");
    eq(results, c6.inCarShow, 1, "C6 In Car Show = 1 (Alice judged Yes)");
    var c8 = out.summary.gens.filter(function (g) { return g.gen === "C8"; })[0];
    eq(results, c8.atEvent, 1, "C8 At Event = 1 (Sponsor, 2022)");
    eq(results, c8.inCarShow, 0, "C8 In Car Show = 0 (Sponsor judged No)");
    var otherGensNonZero = out.summary.gens.filter(function (g) { return g.gen !== "C6" && g.gen !== "C8" && (g.atEvent || g.inCarShow); });
    eq(results, otherGensNonZero.length, 0, "no other generations populated");

    eq(results, out.summary.clubs, [{ name: "Sample Club", attendees: 2 }, { name: "Unknown", attendees: 1 }], "club tally");
    eq(results, out.messages.length, 0, "no messages — sponsorship handled without warning");

    eq(results, out.registrations.length, 28, "28 table rows");
    var walkins = out.registrations.filter(function (r) { return r._isWalkIn; });
    eq(results, walkins.length, 25, "25 walk-in rows");
    var alice = out.registrations.filter(function (r) { return r["First Name"] === "Alice"; })[0];
    eq(results, alice["Member Number"], 100, "Alice keeps her own member #");
    eq(results, alice["Phone"], "(555) 555-0100", "Alice phone formatted");
    eq(results, alice["Gen"], "C6", "Alice gen C6");
    eq(results, alice["In Car Show?"], "Yes", "Alice In Car Show? = Yes");
    var bob = out.registrations.filter(function (r) { return r["First Name"] === "Bob"; })[0];
    eq(results, bob["Member Number"], 8001, "Bob (non-member) assigned 8001");
    var sponsor = out.registrations.filter(function (r) { return r["First Name"] === "Sponsor"; })[0];
    eq(results, sponsor["Status"], "Cancelled", "Sponsor row kept (showCancelled=true)");
    eq(results, Number(sponsor["Total Fee"]), 140, "Sponsor fee = 140");
    eq(results, Number(sponsor["Individual Sponsorship"]), 100, "Sponsor's Individual Sponsorship column = 100");
    eq(results, alice["Individual Sponsorship"], "", "Alice (no sponsorship activity) has blank Individual Sponsorship");
    eq(results, out.summary.sponsorship, 100, "summary.sponsorship = 100");

    var walkNums = walkins.map(function (r) { return r["Member Number"]; }).sort(function (a, b) { return a - b; });
    eq(results, walkNums[0], 8002, "first walk-in # 8002");
    eq(results, walkNums[walkNums.length - 1], 8026, "last walk-in # 8026");

    eq(results, out.registrations[0]["Last Name"], "Sample", "first row sorts to Sample");
    eq(results, /^z-> Walk-In/.test(out.registrations[out.registrations.length - 1]["Last Name"]), true, "walk-ins last");

    return { out: out, results: results };
  }

  // Excel export round-trip (build a workbook, reload it, check shape).
  function excelAssertionList(out, ExcelJS) {
    var results = [];
    return Promise.resolve().then(function () {
      var wb = EXCEL.build(ExcelJS, out);
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var wb2 = new ExcelJS.Workbook();
      return wb2.xlsx.load(buf).then(function () { return wb2; });
    }).then(function (wb2) {
      var reg = wb2.getWorksheet("RegistrationSheet");
      var sum = wb2.getWorksheet("SummarySheet");
      eq(results, !!reg, true, "RegistrationSheet exists");
      eq(results, !!sum, true, "SummarySheet exists");
      eq(results, reg.getCell(1, 1).value, out.meta.title, "title row A1");
      eq(results, reg.getCell(2, 1).value, "Last Name", "header A2 = Last Name");
      eq(results, reg.actualRowCount, 30, "reg sheet has 30 rows");
      eq(results, !!reg.autoFilter, true, "autofilter set");
      eq(results, reg.views[0].state, "frozen", "frozen panes");
      var feeCol = out.columns.indexOf("Total Fee") + 1;
      var sawMoney = false;
      reg.eachRow(function (row) { var c = row.getCell(feeCol); if (c.numFmt && /\$/.test(c.numFmt)) sawMoney = true; });
      eq(results, sawMoney, true, "Total Fee column has $ number format");
      var shirtColsInExcel = out.shirtColumns.filter(function (c) { return out.columns.indexOf(c) !== -1; });
      eq(results, shirtColsInExcel.length, 24, "Excel export still has all 24 shirt columns");
      return results;
    });
  }

  var API = { assertionList: assertionList, excelAssertionList: excelAssertionList };
  root.CarShowRegressionTests = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
