/* Headless UI smoke test: render app.js in jsdom, inject parsed rows via the
 * debug hook, and assert the DOM shows the right table + summary. Uses the
 * frozen synthetic fixture in test/fixtures/ (fabricated data, no real member
 * info) — never point this at the live Exports folder, see run-tests.js. */
var fs = require("fs");
var path = require("path");
var Papa = require("papaparse");
var { JSDOM } = require("jsdom");

var FIXTURES = path.join(__dirname, "fixtures");
function parse(f) { return Papa.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8"), { header: true, skipEmptyLines: true }).data; }
var reg = parse("registration.csv");
var act = parse("activity.csv");

var dom = new JSDOM(
  '<!DOCTYPE html><html><body><header class="app"></header>' +
  '<div class="wrap"><div id="drop" class="drop"></div><div id="app"></div></div></body></html>',
  { pretendToBeVisual: true });

global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
// app.js references these two as bare globals (not passed into runInApp below),
// so they must live on Node's real global, not just dom.window.
global.Papa = Papa;
global.ExcelJS = require("exceljs");

// config/logic attach to Node global; bridge onto the jsdom window BEFORE app.js runs.
var CONFIG = require("../src/config.js");
var LOGIC = require("../src/logic.js");
dom.window.CarShowConfig = CONFIG;
dom.window.CarShowLogic = LOGIC;
dom.window.CarShowRegressionTests = require("../src/regression-tests.js");
dom.window.CarShowFixtures = {
  regCsv: fs.readFileSync(path.join(FIXTURES, "registration.csv"), "utf8"),
  actCsv: fs.readFileSync(path.join(FIXTURES, "activity.csv"), "utf8")
};

// load app.js source into the jsdom window context via eval so its `window`/`document` are jsdom's
var appSrc = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
var runInApp = new Function("window", "document", "Node", appSrc);
runInApp(dom.window, dom.window.document, dom.window.Node);

var fails = 0, passes = 0;
function ok(cond, label) { if (cond) { passes++; console.log("  PASS " + label); } else { fails++; console.log("  FAIL " + label); } }
function tick() { return new Promise(function (r) { setTimeout(r, 5); }); }

var w = dom.window, d = dom.window.document;

(async function () {
  // real browsers fire DOMContentLoaded (jsdom stays 'loading'); dispatch it so init() runs
  d.dispatchEvent(new w.Event("DOMContentLoaded"));

  // initially: drop zone rendered, no table
  ok(d.querySelector("#drop .filecard"), "drop zone renders file slots");
  ok(!d.querySelector("table.grid"), "no table before data");
  ok(d.querySelector("#detailHost"), "detail modal host exists from init()");

  // inject data
  w.__carshow.ingestRows(reg, act);
  await tick(); // initial table body fills via setTimeout

  // app now defaults to the Summary tab (see app.js) — everything through the
  // Print/zoom section below is testing Registration-tab-specific behavior,
  // so switch there explicitly rather than relying on it being the default.
  w.__carshow.setTab("reg");
  await tick(); // the reg table body/rowcount also fill via setTimeout

  // drop zone auto-collapses once there's a real result to look at instead
  ok(d.querySelector("#drop").classList.contains("collapsed"), "drop zone collapses after a successful load");
  ok(!d.querySelector("#drop .filecard"), "drop zone content is cleared, not just hidden");

  // ---- defaults on load: only Paid registrants, walk-ins hidden ----
  // Fixture's 3 real rows are Open/"Not paid in time limit"/Cancelled — none literally
  // "Paid" — and walk-ins are off by default too, so nothing should be visible
  // before anyone touches a checkbox.
  var defaultRows = d.querySelectorAll("table.grid tbody tr");
  ok(defaultRows.length === 0, "no rows visible by default — Paid-only + walk-ins hidden (got " + defaultRows.length + ")");
  var defaultCount = d.querySelector("#rowcount");
  ok(defaultCount && /0 of 28/.test(defaultCount.textContent), "row count label reflects the default filters (got " + (defaultCount && defaultCount.textContent) + ")");
  var wkCheckbox = Array.prototype.filter.call(d.querySelectorAll(".toolbar input[type=checkbox]"), function (cb) { return /walk-ins/.test(cb.closest("label").textContent); })[0];
  ok(wkCheckbox && wkCheckbox.checked === false, "walk-ins checkbox starts unchecked");

  // turn on every status and walk-ins so the rest of this suite exercises the
  // full fixture, same as before these became off-by-default
  w.__carshow.state.statusFilter = { paid: true, notpaid: true, cancelled: true, empty: true };
  w.__carshow.state.showWalkins = true;
  w.__carshow.setSearch("");

  var headers = Array.prototype.map.call(d.querySelectorAll("table.grid thead th"), function (th) { return th.textContent.replace(/[▲▼\s]+$/, "").trim(); });
  ok(headers[0] === "Last Name" && headers[1] === "First Name", "table headers start Last Name, First Name");
  ok(headers[headers.length - 1] === "Shirts", "last header is the collapsed Shirts column (got " + headers[headers.length - 1] + ")");
  ok(headers.indexOf("Men's Free LG") === -1, "individual shirt-bucket columns are gone from the table (collapsed into Shirts)");
  var bodyRows = d.querySelectorAll("table.grid tbody tr");
  ok(bodyRows.length === 28, "28 body rows rendered (got " + bodyRows.length + ")");
  var walkinRows = d.querySelectorAll("table.grid tbody tr.walkin");
  ok(walkinRows.length === 25, "25 walk-in rows styled (got " + walkinRows.length + ")");
  var rowcount = d.querySelector("#rowcount");
  ok(rowcount && /28 of 28/.test(rowcount.textContent), "row count label correct");

  // shirts summary cell shows compact text for rows that have shirts, blank otherwise
  var aliceRow = Array.prototype.filter.call(bodyRows, function (tr) { return /Alice/.test(tr.textContent); })[0];
  ok(aliceRow && /W Free MED/.test(aliceRow.textContent) && /W Xtra SM/.test(aliceRow.textContent), "Alice's row shows both her shirts in the Shirts column");

  // search filters (fixture uses "Sample" as the shared last name; search a first name instead)
  w.__carshow.setSearch("alice");
  ok(d.querySelectorAll("table.grid tbody tr").length === 1, "search 'alice' shows 1 row (got " + d.querySelectorAll("table.grid tbody tr").length + ")");
  w.__carshow.setSearch("");

  // hide walk-ins (also gives the detail-modal Prev/Next test below a small, known N)
  w.__carshow.state.showWalkins = false;
  w.__carshow.setSearch("");
  ok(d.querySelectorAll("table.grid tbody tr").length === 3, "hiding walk-ins leaves 3 rows");

  // ---- detail modal (still just the 3 real rows visible) ----
  ok(!d.querySelector(".modal-backdrop"), "no modal open yet");
  bodyRows = d.querySelectorAll("table.grid tbody tr");
  bodyRows[0].dispatchEvent(new w.Event("click", { bubbles: true }));
  var modal = d.querySelector(".modal-backdrop");
  ok(!!modal, "clicking a row opens the detail modal");
  ok(/Sample/.test(modal.querySelector(".modal-head h3").textContent), "modal header shows the row's name");
  var modalText = modal.querySelector(".modal-body").textContent;
  ok(/Registration/.test(modalText) && /Contact/.test(modalText) && /Vehicle/.test(modalText) && /Shirts/.test(modalText), "modal has all four detail sections");

  // Prev/Next paging, scoped to the 3 visible (non-walk-in) rows
  var countLabel = modal.querySelector(".modal-head .count").textContent;
  ok(/1 of 3/.test(countLabel), "modal shows position 1 of 3 (got " + countLabel + ")");
  w.__carshow.stepDetail(1);
  modal = d.querySelector(".modal-backdrop");
  ok(/2 of 3/.test(modal.querySelector(".modal-head .count").textContent), "Next advances to 2 of 3");

  // close via the debug hook (mirrors what the Escape key / backdrop click do)
  w.__carshow.closeDetail();
  ok(!d.querySelector(".modal-backdrop"), "closeDetail removes the modal");
  w.__carshow.state.showWalkins = true;
  w.__carshow.setTab("reg");

  // ---- print: full columns except the Men's/Women's shirt buckets ----
  var printBtn = Array.prototype.filter.call(d.querySelectorAll(".toolbar .btn"), function (b) { return /Print/.test(b.textContent); })[0];
  printBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  var printHeaders = Array.prototype.map.call(d.querySelectorAll("#printHost table.grid thead th"), function (th) { return th.textContent; });
  ok(printHeaders.indexOf("Men's Free LG") === -1, "print table excludes individual Men's shirt-bucket columns (got " + printHeaders.length + " headers)");
  ok(printHeaders.indexOf("Women's Xtra SM") === -1, "print table excludes individual Women's shirt-bucket columns");
  ok(printHeaders.indexOf("Shirts") !== -1, "print table includes the Shirts summary column (matching the on-screen table)");
  ok(printHeaders.indexOf("Last Name") !== -1 && printHeaders.indexOf("Total Fee") !== -1, "print table still includes non-shirt columns");
  var printRows = d.querySelectorAll("#printHost table.grid tbody tr");
  ok(printRows.length === 28, "print table has all 28 visible rows (got " + printRows.length + ")");
  var alicePrintRow = Array.prototype.filter.call(printRows, function (tr) { return /Alice/.test(tr.textContent); })[0];
  var shirtsColIdx = printHeaders.indexOf("Shirts");
  ok(alicePrintRow && alicePrintRow.querySelectorAll("td")[shirtsColIdx].textContent === "W Free MED, W Xtra SM",
    "print table's Shirts cell summarizes Alice's buckets (got " + (alicePrintRow && alicePrintRow.querySelectorAll("td")[shirtsColIdx].textContent) + ")");

  // ---- zoom controls ----
  var wrap = d.querySelector(".tablewrap");
  ok(wrap.style.zoom === "1", "table starts at 100% zoom (got " + wrap.style.zoom + ")");
  var zoomIn = Array.prototype.filter.call(d.querySelectorAll(".zoomgroup .btn"), function (b) { return b.textContent === "+"; })[0];
  var zoomOut = Array.prototype.filter.call(d.querySelectorAll(".zoomgroup .btn"), function (b) { return b.textContent === "−"; })[0];
  zoomIn.dispatchEvent(new w.Event("click", { bubbles: true }));
  wrap = d.querySelector(".tablewrap");
  ok(wrap.style.zoom === "1.1", "+ increases zoom to 110% (got " + wrap.style.zoom + ")");
  ok(/110%/.test(d.querySelector(".zoomgroup .count").textContent), "zoom label shows 110%");
  d.querySelector(".zoomgroup .btn[title='Zoom out']").dispatchEvent(new w.Event("click", { bubbles: true }));
  d.querySelector(".zoomgroup .btn[title='Zoom out']"); // re-query not needed, but keep intent clear
  wrap = d.querySelector(".tablewrap");
  ok(wrap.style.zoom === "1", "− brings zoom back to 100% (got " + wrap.style.zoom + ")");
  // jsdom doesn't do real layout (scrollWidth/clientWidth are always 0), so Fit
  // can't compute a real ratio here — just confirm it doesn't throw and leaves
  // zoom unchanged rather than corrupting it with a bogus 0/0 computation.
  var fitBtn = Array.prototype.filter.call(d.querySelectorAll(".zoomgroup .btn"), function (b) { return b.textContent === "Fit"; })[0];
  fitBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  ok(d.querySelector(".tablewrap").style.zoom === "1", "Fit is a safe no-op when layout can't be measured (jsdom)");

  // ---- "Load different files" button reopens the drop zone ----
  var changeBtn = Array.prototype.filter.call(d.querySelectorAll(".toolbar .btn"), function (b) { return /Load different files/.test(b.textContent); })[0];
  ok(!!changeBtn, "Load different files button is present in the toolbar");
  changeBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  ok(!d.querySelector("#drop").classList.contains("collapsed"), "clicking it un-collapses the drop zone");
  ok(!!d.querySelector("#drop .filecard"), "drop zone content is back");
  ok(!!d.querySelector("table.grid"), "existing table stays visible alongside the reopened drop zone");

  // summary tab
  w.__carshow.setTab("sum");
  var cardVals = Array.prototype.map.call(d.querySelectorAll(".card .v"), function (v) { return v.textContent; });
  ok(cardVals.indexOf("3") !== -1, "Attendees card = 3");
  ok(cardVals.indexOf("28") !== -1, "Registrations card = 28");
  ok(cardVals.indexOf("8027") !== -1, "Next Member # card = 8027");
  ok(cardVals.some(function (t) { return /\$245/.test(t); }), "Funds card shows $245");
  // Target the Shirts panel specifically by its heading — the Sponsors panel
  // (added later) also renders table.matrix elements (one per sponsor-type
  // card) earlier in the DOM, so "first .panel table.matrix" is ambiguous now.
  var shirtsPanel = Array.prototype.filter.call(d.querySelectorAll(".panel"), function (p) {
    var h3 = p.querySelector("h3");
    return h3 && h3.textContent === "Shirts";
  })[0];
  var matrixCells = Array.prototype.map.call(shirtsPanel.querySelectorAll("table.matrix td"), function (td) { return td.textContent; });
  ok(matrixCells.indexOf("1") !== -1, "shirt matrix shows a 1");
  ok(/Successfully created 28/.test(d.querySelector(".status").textContent), "status shows success");

  // ---- hamburger menu -> Settings -> Run Regression Tests ----
  ok(!!d.querySelector("#hamburgerBtn"), "hamburger button is present in the header");
  ok(!!d.querySelector("#hdrMenu").classList.contains("hidden"), "menu starts hidden");
  d.querySelector("#hamburgerBtn").dispatchEvent(new w.Event("click", { bubbles: true }));
  ok(!d.querySelector("#hdrMenu").classList.contains("hidden"), "clicking the hamburger opens the menu");
  ok(!d.querySelector("#settingsHost .modal-backdrop"), "settings modal not open yet");
  d.querySelector("#settingsMenuItem").dispatchEvent(new w.Event("click", { bubbles: true }));
  ok(d.querySelector("#hdrMenu").classList.contains("hidden"), "picking Settings closes the menu");
  ok(!!d.querySelector("#settingsHost .modal-backdrop"), "Settings item opens the settings modal");

  // Running the tests exercises the real logic + Excel round-trip against the
  // same fixture as test/run-tests.js — this should never touch the 28-row
  // table currently loaded above (checked after, unaffected).
  var runP = w.__carshow.runRegressionTests();
  ok(!!runP && typeof runP.then === "function", "runRegressionTests returns a promise the caller can await");
  await runP;
  var summary = d.querySelector("#settingsHost .test-summary");
  ok(!!summary && /44 passed, 0 failed/.test(summary.textContent), "in-app regression run reports 44 passed, 0 failed (got " + (summary && summary.textContent) + ")");
  ok(d.querySelectorAll("#settingsHost .test-list li.pass").length === 44, "44 passing rows rendered");
  ok(d.querySelectorAll("#settingsHost .test-list li.fail").length === 0, "0 failing rows rendered");

  // "Only show errors" collapses an all-pass run to a friendly empty message
  var onlyErrCb = d.querySelector("#settingsHost .settings-actions input[type=checkbox]");
  onlyErrCb.checked = true;
  onlyErrCb.dispatchEvent(new w.Event("change", { bubbles: true }));
  ok(!d.querySelector("#settingsHost .test-list"), "only-errors hides the list when everything passed");
  ok(/No errors/.test(d.querySelector("#settingsHost .modal-body").textContent), "only-errors shows the all-clear message");

  // running the fixture through Settings must not disturb the real, currently
  // loaded 28-row table underneath the modal
  ok(d.querySelectorAll("table.grid tbody tr").length === 28, "underlying table still shows all 28 rows after running regression tests");

  w.__carshow.closeSettings();
  ok(!d.querySelector("#settingsHost .modal-backdrop"), "closeSettings closes the modal");

  console.log("\n" + passes + " passed, " + fails + " failed");
  process.exit(fails ? 1 : 0);
})();
