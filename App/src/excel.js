/* excel.js — build an .xlsx workbook from a generate() result.
 * Works in browser and Node (pass in the ExcelJS module either way).
 * build(ExcelJS, result) -> ExcelJS.Workbook
 */
(function (root) {
  "use strict";
  var CONFIG = root.CarShowConfig ||
    (typeof require !== "undefined" ? require("./config.js") : null);

  var GREY = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF1F4" } };
  var YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7CC" } };
  var THIN = { style: "thin", color: { argb: "FFD5DAE0" } };
  function border() { return { top: THIN, left: THIN, bottom: THIN, right: THIN }; }

  function fmtDate(d) {
    d = d instanceof Date ? d : new Date(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + h + ":" + p(d.getMinutes()) + " " + ap;
  }
  function isShirt(res, c) { return res.shirtColumns.indexOf(c) !== -1; }

  // sponsors is optional (Sponsors tab data, independent of the CSV-driven res).
  function build(ExcelJS, res, sponsors) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "ETCC Car Show app";
    if (res) {
      regSheet(wb, res);
      summarySheet(wb, res);
    }
    if (sponsors && sponsors.length) sponsorSheet(wb, sponsors);
    if (res && res.messages && res.messages.length) messageSheet(wb, res);
    return wb;
  }

  function sponsorTypeLabel(key) {
    var t = CONFIG.SPONSOR_TYPES.filter(function (x) { return x.key === key; })[0];
    return t ? t.label : (key || "");
  }

  var SPONSOR_COLS = [
    { key: "name", label: "Sponsor Name", width: 22 },
    { key: "contactPerson", label: "Contact Person", width: 18 },
    { key: "phone", label: "Phone", width: 15 },
    { key: "email", label: "Email", width: 26 },
    { key: "address", label: "Address", width: 24 },
    { key: "website", label: "Website", width: 22 },
    { key: "etccMemberName", label: "Member", width: 20 },
    { key: "sponsorType", label: "Sponsor Type", width: 18 },
    { key: "individualSponsorshipText", label: "Ind. Spon. Text", width: 22 },
    { key: "shirtSize", label: "T-Shirt", width: 18 }
  ];

  function sponsorSheet(wb, sponsors) {
    var ws = wb.addWorksheet("SponsorsSheet", { views: [{ state: "frozen", ySplit: 1 }] });
    SPONSOR_COLS.forEach(function (c, i) {
      var cell = ws.getCell(1, i + 1);
      cell.value = c.label; cell.font = { bold: true }; cell.fill = GREY; cell.border = border();
      ws.getColumn(i + 1).width = c.width;
    });
    sponsors.forEach(function (s, ri) {
      SPONSOR_COLS.forEach(function (c, ci) {
        var v = c.key === "sponsorType" ? sponsorTypeLabel(s.sponsorType) : s[c.key];
        var cell = ws.getCell(2 + ri, ci + 1);
        cell.value = v || ""; cell.border = border();
      });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: SPONSOR_COLS.length } };
    return ws;
  }

  function regSheet(wb, res) {
    var cols = res.columns, n = cols.length;
    var ws = wb.addWorksheet("RegistrationSheet", { views: [{ state: "frozen", xSplit: 4, ySplit: 2 }] });
    ws.mergeCells(1, 1, 1, n);
    var t = ws.getCell(1, 1);
    t.value = res.meta.title; t.font = { bold: true, size: 16 }; t.alignment = { horizontal: "center" }; t.fill = YELLOW;
    ws.getRow(1).height = 24;
    cols.forEach(function (c, i) {
      var cell = ws.getCell(2, i + 1);
      cell.value = c; cell.font = { bold: true }; cell.fill = GREY; cell.border = border();
      cell.alignment = { horizontal: isShirt(res, c) ? "center" : "left" };
    });
    ws.getRow(2).height = 22;
    res.registrations.forEach(function (rec, ri) {
      var row = ws.getRow(3 + ri);
      cols.forEach(function (c, ci) {
        var cell = row.getCell(ci + 1), v = rec[c];
        if (isShirt(res, c)) { cell.value = Number(v) > 0 ? Number(v) : null; cell.alignment = { horizontal: "center" }; }
        else if (c === "Total Fee" || c === "Individual Sponsorship") { if (v !== "" && v != null) { cell.value = Number(v); cell.numFmt = "$#,##0.00"; } }
        else if (c === "Reg #" || c === "Year" || c === "#") { cell.value = (v === "" || v == null) ? null : Number(v); }
        else { cell.value = (v === "" || v == null) ? null : v; }
        cell.border = border();
      });
    });
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: n } };
    var widthFor = { "Reg Type": 18, "Email": 26, "Address": 22, "Club Name": 16, "Last Name": 14, "First Name": 12, "Spouse First Name": 14, "Status": 18, "Reg Date": 18, "FreeTShirtSize": 15, "FreeTShirtSize Comments": 16, "Phone": 15, "Payment Type": 14, "Check #": 10 };
    ws.columns.forEach(function (col, i) {
      var name = cols[i];
      col.width = widthFor[name] || (isShirt(res, name) ? 7 : Math.min(Math.max(name.length + 2, 8), 20));
    });
    return ws;
  }

  function summarySheet(wb, res) {
    var s = res.summary, m = res.meta, C = CONFIG;
    var ws = wb.addWorksheet("SummarySheet");
    [22, 16, 16, 16, 16].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var r = 1;
    function section(title) { var c = ws.getCell(r, 1); c.value = title; c.font = { bold: true, size: 13 }; c.fill = YELLOW; ws.mergeCells(r, 1, r, 5); r++; }
    function kv(k, v) { ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { bold: true }; ws.getCell(r, 2).value = v; r++; }

    section(res.meta.title);
    kv("Generated", fmtDate(m.generatedAt));
    kv("Status", m.statusMessage);
    kv("Registration File", m.regFileName + " (" + m.regRows + " rows)");
    kv("Activity File", m.actFileName ? m.actFileName + " (" + m.actRows + " rows)" : "none");
    r++;
    section("Registration");
    kv("Attendees", s.attendees);
    kv("Registrations", s.registrations);
    ws.getCell(r, 1).value = "Funds"; ws.getCell(r, 1).font = { bold: true };
    var fv = ws.getCell(r, 2); fv.value = Number(s.funds); fv.numFmt = "$#,##0.00"; r++;
    kv("Next Available Member Number", s.nextMemberNumber);
    r++;
    section("Shirts");
    ws.getCell(r, 1).value = "Size"; ws.getCell(r, 1).font = { bold: true };
    C.GROUPS.forEach(function (g, i) { var c = ws.getCell(r, 2 + i); c.value = g.label; c.font = { bold: true }; });
    r++;
    C.SIZES.forEach(function (sz) {
      ws.getCell(r, 1).value = sz.label; ws.getCell(r, 1).font = { bold: true };
      C.GROUPS.forEach(function (g, i) { ws.getCell(r, 2 + i).value = s.shirtTotals[g.key + sz.key] || 0; });
      r++;
    });
    r++;
    section("Car Show");
    kv("Judges", s.judges);
    ["Generation", "Years", "At Event", "In Car Show"].forEach(function (h, i) { var c = ws.getCell(r, 1 + i); c.value = h; c.font = { bold: true }; });
    r++;
    s.gens.forEach(function (g) {
      ws.getCell(r, 1).value = g.gen; ws.getCell(r, 2).value = g.from + "-" + g.to;
      ws.getCell(r, 3).value = g.atEvent; ws.getCell(r, 4).value = g.inCarShow; r++;
    });
    r++;
    section("Clubs");
    ws.getCell(r, 1).value = "Club"; ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = "Attendees"; ws.getCell(r, 2).font = { bold: true }; r++;
    s.clubs.forEach(function (c) { ws.getCell(r, 1).value = c.name; ws.getCell(r, 2).value = c.attendees; r++; });
    return ws;
  }

  function messageSheet(wb, res) {
    var ws = wb.addWorksheet("MessageSheet");
    ws.getColumn(1).width = 80;
    res.messages.forEach(function (msg, i) { ws.getCell(i + 1, 1).value = msg; });
    return ws;
  }

  var API = { build: build };
  root.CarShowExcel = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
