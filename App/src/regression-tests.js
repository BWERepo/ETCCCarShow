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
  var CONFIG = root.CarShowConfig ||
    (typeof require !== "undefined" ? require("./config.js") : null);

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
    eq(results, out.summary.registrations, 3, "Registrations = 3");
    eq(results, out.summary.attendees, 3, "Attendees = 3");
    eq(results, out.summary.funds, 245, "Funds = 245");
    // Only Bob (the fixture's one non-member) gets auto-numbered — walk-in
    // placeholder rows were removed from generate() this session (see
    // PROJECT_STATUS.md); 8002 is the next slot after Bob's 8001, not the
    // old 8027 (which counted 25 now-nonexistent placeholder rows too).
    eq(results, out.summary.nextMemberNumber, 8002, "Next member # = 8002");

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

    eq(results, out.registrations.length, 3, "3 table rows");
    // Every CSV-derived row is unconditionally "Pre-Registered" — walk-in
    // rows (Reg Type WALKIN_MEMBER/WALKIN_NONMEMBER) only ever come from the
    // Registration tab's Add Registration form (buildManualRegistration in
    // this same logic.js), a separate code path generate() never touches.
    var regTypes = out.registrations.map(function (r) { return r["Reg Type"]; });
    eq(results, regTypes, ["Pre-Registered", "Pre-Registered", "Pre-Registered"], "all 3 rows are Pre-Registered");
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
    // Individual Sponsorship Text has no CSV source — generate() defaults it
    // to "First [and Spouse] Last" whenever Individual Sponsorship > 0 and
    // it's still blank (see applySponsorshipTextDefault in logic.js).
    eq(results, sponsor["Individual Sponsorship Text"], "Sponsor Sample", "Sponsor's Individual Sponsorship Text defaults to their name");
    eq(results, alice["Individual Sponsorship Text"], "", "Alice (no sponsorship) has blank Individual Sponsorship Text");
    eq(results, sponsor["Spouse First Name"], "", "Spouse First Name has no CSV source — always blank on a fresh CSV row");

    eq(results, out.registrations[0]["Last Name"], "Sample", "first row sorts to Sample");

    manualRegistrationAssertions(results);

    return { out: out, results: results };
  }

  // buildManualRegistration() — the Registration tab's "+ Add Registration"
  // form (Walk-In Member/Nonmember) builds records with this pure function
  // instead of going through generate(); covered separately since it's a
  // distinct code path generate()'s own assertions above never exercise.
  function manualRegistrationAssertions(results) {
    var member = LOGIC.buildManualRegistration({
      id: "wk_test1",
      regType: "Walk-In Member",
      lastName: "Test", firstName: "Marty",
      memberNumber: "42",
      clubName: "ETCC", phone: "555-1212", email: "marty@example.com",
      address: "1 Main St", city: "Knoxville", state: "TN", zip: "37918",
      year: "1965", model: "Corvette", color: "Red",
      inCarShow: "Yes", freeTShirtSize: "Men's Large",
      totalFee: "50", status: "Paid", regDate: "7/10/2026 6:00 PM"
    });
    eq(results, member["Reg Type"], "Walk-In Member", "manual: Reg Type preserved");
    eq(results, member["Member Number"], 42, "manual: typed Member Number kept, coerced to a number");
    eq(results, member["#"], 1, "manual: attendee count always 1");
    eq(results, member["Gen"], "C2", "manual: Gen derived from Year (1965 -> C2)");
    eq(results, member["Men's Free LG"], 1, "manual: free shirt bucket bumped from FreeTShirtSize");
    eq(results, member["Total Fee"], 50, "manual: Total Fee coerced to a number");
    eq(results, member.id, "wk_test1", "manual: id passed through");

    var nonmember = LOGIC.buildManualRegistration({
      regType: "Walk-In Nonmember",
      lastName: "Test", firstName: "Nora",
      memberNumber: "", nextAvailableMemberNumber: 2005,
      freeTShirtSize: "", inCarShow: "No", status: "Not Paid"
    });
    eq(results, nonmember["Member Number"], 2005, "manual: blank Member Number falls back to nextAvailableMemberNumber");
    eq(results, nonmember["FreeTShirtSize"], "", "manual: no shirt picked -> no bucket bumped");
    var shirtSum = CONFIG.SHIRT_BUCKETS.reduce(function (sum, b) { return sum + (nonmember[b.col] || 0); }, 0);
    eq(results, shirtSum, 0, "manual: all 24 shirt buckets zero when no size picked");

    sponsorshipTextAssertions(results);
  }

  // applySponsorshipTextDefault() — no CSV/fixture row happens to exercise
  // the "and Spouse" branch (see generate()'s own assertions above), so it's
  // covered directly here instead.
  function applyText(rec) { LOGIC.applySponsorshipTextDefault(rec); return rec["Individual Sponsorship Text"]; }
  function sponsorshipTextAssertions(results) {
    eq(results, applyText({ "First Name": "John", "Last Name": "Doe", "Individual Sponsorship": 100, "Individual Sponsorship Text": "" }),
      "John Doe", "sponsorship text: defaults to 'First Last' with no spouse");
    eq(results, applyText({ "First Name": "John", "Spouse First Name": "Jane", "Last Name": "Doe", "Individual Sponsorship": 100, "Individual Sponsorship Text": "" }),
      "John and Jane Doe", "sponsorship text: 'First and Spouse Last' when Spouse First Name is set");
    eq(results, applyText({ "First Name": "John", "Last Name": "Doe", "Individual Sponsorship": 0, "Individual Sponsorship Text": "" }),
      "", "sponsorship text: stays blank when Individual Sponsorship is 0");
    eq(results, applyText({ "First Name": "John", "Last Name": "Doe", "Individual Sponsorship": 100, "Individual Sponsorship Text": "Custom Text" }),
      "Custom Text", "sponsorship text: never overwrites an already-set value");
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
      eq(results, reg.getCell(2, 1).value, "Reg Type", "header A2 = Reg Type");
      eq(results, reg.actualRowCount, 5, "reg sheet has 5 rows (title + header + 3 fixture rows)");
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
