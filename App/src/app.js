/* app.js — DOM wiring, rendering, Excel export. Globals: CarShowConfig,
 * CarShowLogic, Papa, ExcelJS. */
(function () {
  "use strict";
  var CONFIG = window.CarShowConfig;
  var LOGIC = window.CarShowLogic;

  var state = {
    reg: null,   // { name, rows }
    act: null,   // { name, rows }
    result: null,
    sortCol: null,
    sortDir: 1,
    search: "",
    showWalkins: true,
    statusFilter: { paid: true, notpaid: false, cancelled: false, empty: false },
    tab: "reg",
    detailRow: null,  // registration row currently shown in the detail modal, or null
    dropOpen: true,   // whether the "drop the two CSVs here" card is showing
    zoom: 1           // table zoom level (1 = 100%); lets all columns fit without scrolling
  };

  var NUMERIC_BASE = { "Member Number": 1, "Total Fee": 1, "Individual Sponsorship": 1, "Year": 1, "#": 1 };
  // These headers are far wider than their data (a few digits, "Yes"/"No") —
  // force-wrapping them onto two lines shrinks the column to fit the data
  // instead of the label, narrowing the overall row width.
  var NARROW_HEADER_COLS = { "Member Number": 1, "Individual Sponsorship": 1, "In Car Show?": 1 };
  var CURRENCY_COLS = { "Total Fee": 1, "Individual Sponsorship": 1 };
  function fmtMoney(v) { return v === "" || v == null ? "" : "$" + Number(v).toFixed(2); }
  function isShirtCol(c) { return state.result && state.result.shirtColumns.indexOf(c) !== -1; }
  function isNumericCol(c) { return NUMERIC_BASE[c] || isShirtCol(c); }

  // ---------- status filter ----------
  // ClubExpress "Status" values collapse into 4 buckets for the filter: an
  // exact "Paid"/"Cancelled" match, blank (no status), or anything else counts
  // as Not Paid (covers "Not paid in time limit", "Open", etc.).
  var STATUS_BUCKETS = [
    { key: "paid", label: "Paid" },
    { key: "notpaid", label: "Not Paid" },
    { key: "cancelled", label: "Cancelled" },
    { key: "empty", label: "Empty" }
  ];
  function classifyStatus(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "empty";
    var low = s.toLowerCase();
    if (low === "cancelled") return "cancelled";
    if (low === "paid") return "paid";
    return "notpaid";
  }

  // ---------- shirts: 24 sparse columns collapsed into one summary column ----------
  var SHIRTS_COL = "__shirts";
  var GROUP_SHORT = null; // lazy-built from CONFIG.GROUPS: "Men's Free" -> "M Free", etc.
  function groupShort(groupKey) {
    if (!GROUP_SHORT) {
      GROUP_SHORT = {};
      CONFIG.GROUPS.forEach(function (g) { GROUP_SHORT[g.key] = g.label.replace("Men's", "M").replace("Women's", "W"); });
    }
    return GROUP_SHORT[groupKey];
  }
  // Every shirt bucket this row has 1+ of, as { label, qty } — used by both the
  // table's compact summary cell and the detail modal's full breakdown.
  function shirtSummaryParts(row) {
    var parts = [];
    CONFIG.SHIRT_BUCKETS.forEach(function (b) {
      var qty = Number(row[b.col]) || 0;
      if (qty > 0) parts.push({ label: groupShort(b.groupKey) + " " + b.sizeKey, qty: qty });
    });
    return parts;
  }
  function shirtSummaryText(row) {
    return shirtSummaryParts(row).map(function (p) { return p.label + (p.qty > 1 ? " ×" + p.qty : ""); }).join(", ");
  }
  function shirtTotal(row) {
    return shirtSummaryParts(row).reduce(function (sum, p) { return sum + p.qty; }, 0);
  }

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  // ---------- file handling ----------
  function parseCsv(text) {
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  }
  function classify(rows) {
    if (!rows.length) return "empty";
    var keys = Object.keys(rows[0]);
    if (keys.indexOf(CONFIG.activityValidColumn) !== -1) return "act";
    if (keys.indexOf(CONFIG.registrationValidColumn) !== -1) return "reg";
    return "unknown";
  }
  function ingestFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    var pending = files.length, problems = [];
    files.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        var rows = parseCsv(String(r.result));
        var kind = classify(rows);
        if (kind === "reg") state.reg = { name: f.name, rows: rows };
        else if (kind === "act") state.act = { name: f.name, rows: rows };
        else problems.push(f.name + " — unrecognized CSV (need Registration or Activity export).");
        if (--pending === 0) { finishIngest(problems); }
      };
      r.onerror = function () { problems.push(f.name + " — could not read file."); if (--pending === 0) { finishIngest(problems); } };
      r.readAsText(f);
    });
  }
  // Regenerate the result, then decide whether to auto-collapse the drop zone:
  // only once BOTH files are in (registration alone already produces an "ok"
  // result, but closing the drop zone at that point makes it easy to forget
  // the activity file entirely), and only if nothing went wrong (a problem,
  // e.g. an unrecognized file, keeps the drop zone open so the user sees the
  // message and can retry).
  function finishIngest(problems) {
    regenerate();
    if (!problems.length && state.reg && state.act && state.result && state.result.ok) state.dropOpen = false;
    renderDrop(problems);
  }
  function regenerate() {
    if (!state.reg) { state.result = null; renderViews(); return; }
    state.result = LOGIC.generate(state.reg.rows, state.act ? state.act.rows : [], {
      regFileName: state.reg.name,
      actFileName: state.act ? state.act.name : "",
      generatedAt: new Date()
    });
    state.sortCol = null; state.sortDir = 1;
    renderViews();
  }

  // ---------- drop zone ----------
  function showDropZone() { state.dropOpen = true; renderDrop([]); }
  function renderDrop(problems) {
    var drop = $("#drop");
    if (!state.dropOpen) { drop.innerHTML = ""; drop.classList.add("collapsed"); return; }
    drop.classList.remove("collapsed");

    var slot = function (label, file, hint) {
      var kids = [el("div", { class: "name", text: file ? file.name : label })];
      if (file) kids.push(el("div", { class: "meta", text: file.rows.length + " data row" + (file.rows.length === 1 ? "" : "s") }));
      else kids.push(el("div", { class: "meta", text: hint }));
      return el("div", { class: "filecard " + (file ? "ok" : "empty") }, kids);
    };
    var files = el("div", { class: "files" }, [
      slot("Registration Data (not loaded)", state.reg, "drop registration_data*.csv"),
      slot("Activity Registrant Data (not loaded)", state.act, "drop activity_registrant_data*.csv")
    ]);
    var pick = el("input", { type: "file", accept: ".csv", multiple: "multiple", style: "display:none" });
    pick.addEventListener("change", function () { ingestFiles(pick.files); pick.value = ""; });
    var pickBtn = el("button", { class: "btn" }, ["Choose CSV files…"]);
    pickBtn.addEventListener("click", function () { pick.click(); });

    var body = [
      el("h2", { text: "Drop the two ClubExpress CSV exports here" }),
      el("div", { class: "hint", text: "Order doesn't matter — the app detects which file is which. Everything stays on this computer; nothing is uploaded." }),
      files,
      el("div", { style: "margin-top:12px" }, [pickBtn, pick])
    ];
    if (problems && problems.length) {
      body.push(el("ul", { class: "messages", style: "margin-top:12px;text-align:left" },
        problems.map(function (p) { return el("li", { text: p }); })));
    }
    drop.innerHTML = "";
    body.forEach(function (n) { drop.appendChild(n); });
  }

  // ---------- views ----------
  function renderViews() {
    var app = $("#app");
    if (!state.result) { app.innerHTML = ""; return; }
    if (!state.result.ok) {
      app.innerHTML = "";
      app.appendChild(el("div", { class: "panel" }, [
        el("h3", { text: "Could not generate" }),
        el("ul", { class: "messages" }, state.result.messages.map(function (m) { return el("li", { text: m }); }))
      ]));
      return;
    }
    app.innerHTML = "";
    app.appendChild(buildTabs());
    if (state.tab === "reg") app.appendChild(buildLoadedInfo());
    var toolbar = state.tab === "reg" ? buildRegToolbar() : buildSummaryToolbar();
    app.appendChild(toolbar);
    app.appendChild(state.tab === "reg" ? buildRegView() : buildSummaryView());
  }

  function buildTabs() {
    var mk = function (id, label) {
      var t = el("div", { class: "tab" + (state.tab === id ? " active" : ""), text: label });
      t.addEventListener("click", function () { state.tab = id; renderViews(); });
      return t;
    };
    return el("div", { class: "tabs no-print" }, [mk("reg", "Registration"), mk("sum", "Summary")]);
  }

  // CSVs are (re)ingested synchronously right before regenerate() runs, so
  // meta.generatedAt doubles as "when the currently-loaded CSVs were loaded".
  function buildLoadedInfo() {
    return el("div", { class: "loadedinfo" }, ["CSVs loaded: " + fmtDate(state.result.meta.generatedAt)]);
  }

  function buildChangeFilesBtn() {
    var b = el("button", { class: "btn" }, ["📂 Load different files"]);
    b.addEventListener("click", showDropZone);
    return b;
  }

  function buildRegToolbar() {
    var search = el("input", { type: "search", placeholder: "Search name, club, email…", value: state.search });
    search.addEventListener("input", function () { state.search = search.value; renderRegBody(); });
    var wk = el("input", { type: "checkbox" }); wk.checked = state.showWalkins;
    wk.addEventListener("change", function () { state.showWalkins = wk.checked; renderRegBody(); });

    var statusGroup = el("span", { class: "statusgroup" }, [
      el("span", { class: "hint" }, ["Status:"])
    ].concat(STATUS_BUCKETS.map(function (b) {
      var cb = el("input", { type: "checkbox" }); cb.checked = state.statusFilter[b.key];
      cb.addEventListener("change", function () { state.statusFilter[b.key] = cb.checked; renderRegBody(); });
      return el("label", {}, [cb, document.createTextNode(" " + b.label)]);
    })));

    var xls = el("button", { class: "btn primary" }, ["⬇ Download Excel"]);
    xls.addEventListener("click", function () { downloadExcel(); });
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", printRegistration);

    var zoomOut = el("button", { class: "btn", title: "Zoom out" }, ["−"]);
    zoomOut.addEventListener("click", function () { setZoom(state.zoom - 0.1); });
    var zoomIn = el("button", { class: "btn", title: "Zoom in" }, ["+"]);
    zoomIn.addEventListener("click", function () { setZoom(state.zoom + 0.1); });
    var zoomFit = el("button", { class: "btn", title: "Shrink just enough to fit every column on screen" }, ["Fit"]);
    zoomFit.addEventListener("click", fitZoom);
    var zoomLabel = el("span", { class: "count", text: Math.round(state.zoom * 100) + "%" });
    var zoomGroup = el("span", { class: "zoomgroup" }, [zoomOut, zoomLabel, zoomIn, zoomFit]);

    var count = el("span", { class: "count", id: "rowcount" });
    return el("div", { class: "toolbar no-print" }, [
      search,
      el("label", {}, [wk, document.createTextNode(" walk-ins")]),
      statusGroup,
      count,
      el("span", { class: "spacer" }),
      zoomGroup,
      buildChangeFilesBtn(), prn, xls
    ]);
  }
  function buildSummaryToolbar() {
    var xls = el("button", { class: "btn primary" }, ["⬇ Download Excel"]);
    xls.addEventListener("click", function () { downloadExcel(); });
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", function () { clearPrintHost(); window.print(); });
    return el("div", { class: "toolbar no-print" }, [el("span", { class: "spacer" }), buildChangeFilesBtn(), prn, xls]);
  }

  // ---------- print (Registration tab: print every column, not just what's on screen) ----------
  // The on-screen table deliberately collapses 24 shirt columns into one summary
  // column and only shows what's currently sorted/searched/scrolled — printing
  // should still give a complete paper record, so this builds a separate,
  // print-only table with every column instead of reusing the visible one.
  function clearPrintHost() { var host = $("#printHost"); if (host) host.innerHTML = ""; }
  function printRegistration() {
    var host = $("#printHost");
    host.innerHTML = "";
    // All columns except the 24 individual Men's/Women's shirt-size buckets and
    // the FreeTShirtSize columns — excluded from print entirely, per request;
    // a "Shirts" summary column (matching the on-screen table) is appended
    // instead of the 24 raw buckets.
    var cols = state.result.columns.filter(function (c) {
      return c.indexOf("Men's") !== 0 && c.indexOf("Women's") !== 0 &&
        c !== "FreeTShirtSize" && c !== "FreeTShirtSize Comments";
    });
    var headerLabels = cols.concat(["Shirts"]);
    var thead = el("thead", {}, [el("tr", {}, headerLabels.map(function (c) { return el("th", {}, [c]); }))]);
    var tbody = el("tbody", {}, visibleRows().map(function (r) {
      var cells = cols.map(function (c) {
        var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : r[c];
        return el("td", {}, [v == null ? "" : String(v)]);
      });
      cells.push(el("td", { class: "shirtsum" }, [shirtSummaryText(r)]));
      return el("tr", r._isWalkIn ? { class: "walkin" } : {}, cells);
    }));
    host.appendChild(el("h2", { text: state.result.meta.title }));
    host.appendChild(el("table", { class: "grid" }, [thead, tbody]));
    window.print();
  }

  // Base (non-shirt) columns, plus one "Shirts" summary column standing in for
  // the 24 individual shirt-size buckets (which are almost always zero) — this
  // is what shrinks the table enough to avoid horizontal scrolling for most rows.
  // FreeTShirtSize / FreeTShirtSize Comments are also dropped from the on-screen
  // table as redundant with the Shirts summary column (still shown in the detail
  // modal). The Excel export is unaffected and still lists everything, including
  // all 24 individual shirt buckets, since that detail matters for ordering
  // shirts even though it's noise on screen.
  function visibleColumns() {
    var base = state.result.columns.filter(function (c) {
      return !isShirtCol(c) && c !== "FreeTShirtSize" && c !== "FreeTShirtSize Comments";
    });
    base.push(SHIRTS_COL);
    return base;
  }

  function buildRegView() {
    var cols = visibleColumns();
    var thead = el("thead"), htr = el("tr");
    cols.forEach(function (c, idx) {
      var label = c === SHIRTS_COL ? "Shirts" : c;
      var arrow = state.sortCol === c ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
      var th = el("th", { class: (c === SHIRTS_COL ? "shirtsum" : (isNumericCol(c) ? "num" : "")) +
          (NARROW_HEADER_COLS[c] ? " narrow-hdr" : "") + pinnedClass(idx) },
        [label, el("span", { class: "arrow", text: arrow })]);
      th.addEventListener("click", function () {
        if (state.sortCol === c) state.sortDir = -state.sortDir; else { state.sortCol = c; state.sortDir = 1; }
        renderViews();
      });
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    var table = el("table", { class: "grid" }, [thead, el("tbody", { id: "regbody" })]);
    var wrap = el("div", { class: "tablewrap", style: "zoom:" + state.zoom }, [table]);
    setTimeout(renderRegBody, 0);
    return wrap;
  }

  // ---------- pinned columns (Last Name + First Name stay visible while scrolling) ----------
  // Both are `position: sticky`, so the second one needs its `left` set to the
  // rendered width of the first — otherwise they'd both sit at left:0 and
  // overlap/mangle each other's text.
  function pinnedClass(idx) {
    if (idx === 0) return " pinned pin-1";
    if (idx === 1) return " pinned pin-2";
    return "";
  }
  function updatePinnedOffsets() {
    var table = $(".tablewrap table.grid");
    var headRow = table && table.querySelector("thead tr");
    var firstCell = headRow && headRow.children[0];
    if (!firstCell) return;
    // getBoundingClientRect is in post-zoom (visual) px; the `zoom` CSS property
    // re-scales inline-style lengths too, so divide back out or the offset
    // would be applied twice.
    var w = firstCell.getBoundingClientRect().width / state.zoom;
    var cells = table.querySelectorAll(".pin-2");
    for (var i = 0; i < cells.length; i++) cells[i].style.left = w + "px";
  }

  // ---------- zoom (shrink the table so all columns fit without horizontal scrolling) ----------
  function setZoom(z) {
    state.zoom = Math.max(0.3, Math.min(1.5, z));
    renderViews();
  }
  // Measure how wide the table naturally wants to be vs. how much room is
  // actually available, and pick a zoom level that makes every column fit —
  // instead of making the user guess a percentage via the +/- buttons.
  function fitZoom() {
    var wrap = $(".tablewrap");
    var table = wrap && wrap.querySelector("table.grid");
    if (!wrap || !table) return;
    var availableWidth = wrap.parentElement.clientWidth; // not itself zoomed
    var priorZoom = wrap.style.zoom;
    wrap.style.zoom = "1"; // measure at true scale, independent of current zoom
    var naturalWidth = table.scrollWidth;
    wrap.style.zoom = priorZoom;
    if (!naturalWidth) return;
    setZoom(availableWidth / naturalWidth);
  }

  function sortedRows() {
    var rows = state.result.registrations.slice();
    if (state.sortCol) {
      var c = state.sortCol, dir = state.sortDir;
      if (c === SHIRTS_COL) {
        rows.sort(function (a, b) { return (shirtTotal(a) - shirtTotal(b)) * dir; });
        return rows;
      }
      var num = isNumericCol(c);
      rows.sort(function (a, b) {
        var av = a[c], bv = b[c];
        if (num) { av = av === "" || av == null ? -Infinity : Number(av); bv = bv === "" || bv == null ? -Infinity : Number(bv); return (av - bv) * dir; }
        av = String(av == null ? "" : av).toLowerCase(); bv = String(bv == null ? "" : bv).toLowerCase();
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      });
    }
    return rows;
  }

  // The exact set of rows currently on screen, in order — shared by the table
  // body and the detail modal's Prev/Next so paging through the modal follows
  // the same sort/search/walk-in state the user has the table set to.
  function visibleRows() {
    var cols = visibleColumns();
    var q = state.search.trim().toLowerCase();
    return sortedRows().filter(function (r) {
      if (!state.showWalkins && r._isWalkIn) return false;
      if (!r._isWalkIn && !state.statusFilter[classifyStatus(r["Status"])]) return false;
      if (!q) return true;
      return cols.some(function (c) {
        var v = c === SHIRTS_COL ? shirtSummaryText(r) : r[c];
        return String(v == null ? "" : v).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function renderRegBody() {
    if (state.tab !== "reg") return;
    var body = $("#regbody"); if (!body) return;
    var cols = visibleColumns();
    var rows = visibleRows();
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) {
      var tr = el("tr", r._isWalkIn ? { class: "walkin" } : {});
      tr.title = "Click for full details";
      tr.addEventListener("click", function () { openDetail(r); });
      cols.forEach(function (c, idx) {
        var v, cls = "";
        if (c === SHIRTS_COL) { cls = "shirtsum"; v = shirtSummaryText(r); }
        else if (CURRENCY_COLS[c]) { cls = "num"; v = fmtMoney(r[c]); }
        else if (isNumericCol(c)) { cls = "num"; v = r[c]; v = v == null ? "" : v; }
        else { v = r[c]; }
        cls += pinnedClass(idx);
        tr.appendChild(el("td", { class: cls.trim(), text: v == null ? "" : String(v) }));
      });
      frag.appendChild(tr);
    });
    body.innerHTML = "";
    body.appendChild(frag);
    updatePinnedOffsets();
    var rc = $("#rowcount");
    if (rc) rc.textContent = rows.length + " of " + state.result.registrations.length + " rows shown";
  }

  // ---------- detail modal ----------
  // Click any row to see every field for that one registration without scrolling —
  // grouped into readable sections instead of the table's 40+ side-by-side columns.
  var DETAIL_SECTIONS = [
    { title: "Registration", cols: ["Reg Date", "Reg Type", "Status", "Total Fee", "Individual Sponsorship", "#"] },
    { title: "Contact", cols: ["Phone", "Email", "Address", "City", "State", "Zip"] },
    { title: "Vehicle", cols: ["Year", "Model", "Color", "Gen", "In Car Show?"] },
    { title: "Shirt Selection", cols: ["FreeTShirtSize", "FreeTShirtSize Comments"] }
  ];
  function openDetail(row) { state.detailRow = row; renderDetailModal(); }
  function closeDetail() { state.detailRow = null; renderDetailModal(); }
  function stepDetail(dir) {
    var list = visibleRows(), i = list.indexOf(state.detailRow);
    if (i === -1) return;
    var next = list[i + dir];
    if (next) { state.detailRow = next; renderDetailModal(); }
  }
  function renderDetailModal() {
    var host = $("#detailHost");
    if (!host) return;
    host.innerHTML = "";
    var r = state.detailRow;
    if (!r) return;
    var list = visibleRows(), i = list.indexOf(r);

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDetail);
    var prevBtn = el("button", { class: "btn" }, ["‹ Prev"]);
    if (i <= 0) prevBtn.setAttribute("disabled", "disabled");
    prevBtn.addEventListener("click", function () { stepDetail(-1); });
    var nextBtn = el("button", { class: "btn" }, ["Next ›"]);
    if (i === -1 || i >= list.length - 1) nextBtn.setAttribute("disabled", "disabled");
    nextBtn.addEventListener("click", function () { stepDetail(1); });

    var name = (r["Last Name"] || "") + (r["First Name"] ? ", " + r["First Name"] : "");
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: name || "Registration" }),
      el("span", { class: "count", text: i > -1 ? (i + 1) + " of " + list.length : "" }),
      prevBtn, nextBtn, closeBtn
    ]);

    var body = el("div", { class: "modal-body" }, [
      el("ul", { class: "meta-list" }, [
        li("Member Number", String(r["Member Number"] == null ? "" : r["Member Number"])),
        li("Club Name", String(r["Club Name"] == null ? "" : r["Club Name"]))
      ])
    ]);
    DETAIL_SECTIONS.forEach(function (sec) {
      var items = sec.cols.filter(function (c) { return state.result.columns.indexOf(c) !== -1; }).map(function (c) {
        var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : r[c];
        return li(c, v == null || v === "" ? "—" : String(v));
      });
      if (items.length) body.appendChild(el("div", { class: "modal-section" }, [el("h4", { text: sec.title }), el("ul", { class: "meta-list" }, items)]));
    });

    var parts = shirtSummaryParts(r);
    var shirtItems = parts.length ? parts.map(function (p) { return li(p.label, String(p.qty)); })
      : [el("li", { class: "hint", text: "No shirts on this registration." })];
    body.appendChild(el("div", { class: "modal-section" }, [el("h4", { text: "Shirts" }), el("ul", { class: "meta-list" }, shirtItems)]));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDetail);
    host.appendChild(backdrop);
  }

  // ---------- summary ----------
  // Recomputed from whatever the Registration tab's search/status/walk-ins
  // filters currently leave visible, rather than always the full loaded
  // dataset — so this tab always reflects "what I've selected over there".
  // nextMemberNumber is the one exception: it's a capacity-planning figure
  // (next open slot overall), not something filtering should change.
  function buildSummaryView() {
    var full = state.result.summary;
    var s = LOGIC.summarizeRecords(visibleRows(), CONFIG);
    s.nextMemberNumber = full.nextMemberNumber;
    var m = state.result.meta, C = CONFIG;
    var container = el("div", { class: "view" });

    // status + meta
    var statusCls = m.errorCount === 0 ? "status good" : "status warn";
    container.appendChild(el("div", { class: "panel" }, [
      el("h3", { text: state.result.meta.title }),
      el("ul", { class: "meta-list" }, [
        li("Generated", fmtDate(m.generatedAt) + "  —  ", el("span", { class: statusCls, text: m.statusMessage })),
        li("Registration file", m.regFileName + "  (" + m.regRows + " rows)"),
        li("Activity file", m.actFileName ? m.actFileName + "  (" + m.actRows + " rows)" : "— none loaded —"),
        li("Showing", s.registrations + " of " + full.registrations + " registrations — matches the Registration tab's current search/status/walk-ins filters")
      ])
    ]));

    // totals cards
    container.appendChild(el("div", { class: "cards" }, [
      card("Attendees", s.attendees),
      card("Registrations", s.registrations),
      card("Funds", "$" + Number(s.funds).toLocaleString(undefined, { minimumFractionDigits: 0 })),
      card("Individual Sponsorships", "$" + Number(s.sponsorship).toLocaleString(undefined, { minimumFractionDigits: 0 })),
      card("Next Member #", s.nextMemberNumber)
    ]));

    // shirts matrix
    container.appendChild(el("div", { class: "panel" }, [el("h3", { text: "Shirts" }), shirtMatrix(s)]));

    // car show matrix
    container.appendChild(el("div", { class: "panel" }, [
      el("h3", { text: "Car Show" }),
      el("div", { style: "margin-bottom:8px" }, ["Judges: " + s.judges]),
      genMatrix(s)
    ]));

    // clubs
    var clubRows = s.clubs.map(function (c) {
      return el("tr", {}, [el("td", { class: "lbl", text: c.name }), el("td", { text: String(c.attendees) })]);
    });
    container.appendChild(el("div", { class: "panel" }, [
      el("h3", { text: "Clubs" }),
      el("table", { class: "matrix" }, [
        el("thead", {}, [el("tr", {}, [el("th", { class: "lbl", text: "Club" }), el("th", { text: "Attendees" })])]),
        el("tbody", {}, clubRows)
      ])
    ]));

    // messages
    if (state.result.messages.length) {
      container.appendChild(el("div", { class: "panel" }, [
        el("h3", { text: "Messages (" + state.result.messages.length + ")" }),
        el("ul", { class: "messages" }, state.result.messages.map(function (x) { return el("li", { text: x }); }))
      ]));
    }
    return container;
  }
  function li(k, v, extra) {
    var kids = [el("span", { class: "k", text: k }), document.createTextNode(v)];
    if (extra) kids.push(extra);
    return el("li", {}, kids);
  }
  function card(k, v) { return el("div", { class: "card" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: String(v) })]); }

  function shirtMatrix(s) {
    var C = CONFIG;
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" })].concat(
      C.GROUPS.map(function (g) { return el("th", { text: g.label }); })));
    var body = C.SIZES.map(function (sz) {
      var cells = [el("td", { class: "lbl", text: sz.label })];
      C.GROUPS.forEach(function (g) {
        var key = g.key + sz.key, val = s.shirtTotals[key] || 0;
        cells.push(el("td", { class: val ? "" : "z", text: val ? String(val) : "0" }));
      });
      return el("tr", {}, cells);
    });
    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, body)]);
  }
  function genMatrix(s) {
    var head = el("tr", {}, [
      el("th", { class: "lbl", text: "Generation" }), el("th", { text: "Years" }),
      el("th", { text: "At Event" }), el("th", { text: "In Car Show" })
    ]);
    var body = s.gens.map(function (g) {
      return el("tr", {}, [
        el("td", { class: "lbl", text: g.gen }),
        el("td", { text: g.from + "–" + g.to }),
        el("td", { class: g.atEvent ? "" : "z", text: String(g.atEvent) }),
        el("td", { class: g.inCarShow ? "" : "z", text: String(g.inCarShow) })
      ]);
    });
    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, body)]);
  }

  function fmtDate(d) {
    d = d instanceof Date ? d : new Date(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + h + ":" + p(d.getMinutes()) + " " + ap;
  }

  // ---------- Excel export (ExcelJS) ----------
  function downloadExcel() {
    var res = state.result; if (!res || !res.ok) return;
    var wb = window.CarShowExcel.build(ExcelJS, res);
    wb.xlsx.writeBuffer().then(function (buf) {
      var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ETCCCarShow.xlsx";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  // ---------- drag/drop wiring ----------
  function wireDrop() {
    var drop = $("#drop");
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove("drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
    });
    // also accept a global drop anywhere
    ["dragover", "drop"].forEach(function (ev) { window.addEventListener(ev, function (e) { e.preventDefault(); }); });
  }

  function init() {
    document.body.appendChild(el("div", { id: "detailHost" }));
    document.body.appendChild(el("div", { id: "printHost" }));
    document.addEventListener("keydown", function (e) {
      if (!state.detailRow) return;
      if (e.key === "Escape") closeDetail();
      else if (e.key === "ArrowLeft") stepDetail(-1);
      else if (e.key === "ArrowRight") stepDetail(1);
    });
    renderDrop([]);
    wireDrop();
    renderViews();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Debug/test hook (harmless in production): drive the app without file I/O.
  window.__carshow = {
    get state() { return state; },
    ingestRows: function (regRows, actRows) {
      state.reg = { name: "registration.csv", rows: regRows };
      state.act = actRows ? { name: "activity.csv", rows: actRows } : null;
      finishIngest([]);
    },
    showDropZone: showDropZone,
    setTab: function (t) { state.tab = t; renderViews(); },
    setSearch: function (q) { state.search = q; renderRegBody(); },
    openDetail: openDetail,
    closeDetail: closeDetail,
    stepDetail: stepDetail
  };
})();
