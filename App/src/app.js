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
    showWalkins: false,
    statusFilter: { paid: true, notpaid: false, cancelled: false, empty: false },
    tab: "sum",
    detailRow: null,  // registration row currently shown in the detail modal, or null
    dropOpen: true,   // whether the "drop the two CSVs here" card is showing
    zoom: 1,          // table zoom level (1 = 100%); lets all columns fit without scrolling
    menuOpen: false,      // hamburger dropdown
    settingsOpen: false,  // settings modal
    testResults: null,    // { results: [{label, ok, expected, actual}], passed, failed } | null
    testRunning: false,
    testOnlyErrors: false,
    sponsors: [],          // loaded from localStorage in init() UNLESS LIVE mode (see below)
    sponsorSearch: "",
    sponsorTypeFilter: { premier: true, corporate: true, individual: true },
    sponsorEditing: null,  // sponsor record being added/edited in the form modal, or null
    importOpen: false,     // "Import from Server" modal (offline tool only — see LIVE below)
    sponsorSyncError: null, // set when a LIVE-mode push to the server fails; shown in the Sponsors tab
    clearSponsorsOpen: false, // "Remove All Sponsors" confirmation modal
    sponsorSelected: {},    // id -> true, for the Sponsors tab's row checkboxes
    deleteSelectedOpen: false, // "Delete selected sponsors" confirmation modal
    developerOpen: false,      // hamburger's "Developer" password prompt expanded
    developerUnlocked: false,  // password verified this page load — reveals Import Members/Registrations
    developerError: null       // developer password error message, or null
  };

  // Set only when this page was served by deploy/index.php (the hosted site) — that
  // template injects `window.__carshowLive = { sponsorsApiUrl: "..." }` as the very
  // first inline script, before app.js runs, specifically so it's visible here. It's
  // never present in the offline ETCCCarShow.html build. When set, the Sponsors tab is
  // server-authoritative: state.sponsors is fetched fresh (via ingestSponsors(), called
  // by index.php's boot script) instead of read from localStorage, and every
  // add/edit/delete is pushed straight to sponsorsApiUrl instead of saved locally — so
  // every officer viewing the hosted site sees the same live list, with no separate
  // Import step. The offline tool is untouched: LIVE stays null there, and it keeps
  // using localStorage + the manual "Import from Server" pull exactly as before.
  var LIVE = null;

  // The public sponsor form's companion read API (deploy/sponsor-submissions.php) —
  // see App/deploy/README.md. Used only by the offline tool's "Import from Server"
  // (LIVE mode doesn't need it — the hosted site is already always current).
  var DEFAULT_IMPORT_URL = "https://etccapps.com/apps/carshow/sponsor-submissions.php";

  // ---------- sponsors: storage (localStorage, independent of the CSV data) ----------
  var SPONSORS_STORAGE_KEY = "etccCarShowSponsors_v1";
  function loadSponsors() {
    try {
      var raw = window.localStorage.getItem(SPONSORS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveSponsors(list) {
    try { window.localStorage.setItem(SPONSORS_STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable (e.g. private browsing) */ }
  }

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
  function finishIngest(problems, generatedAt) {
    regenerate(generatedAt);
    if (!problems.length && state.reg && state.act && state.result && state.result.ok) state.dropOpen = false;
    renderDrop(problems);
  }
  // generatedAt defaults to "now" (correct when a person just dropped the
  // files in), but callers with a real known ingestion time — e.g. the
  // hosted snapshot replaying its embedded CSVs on every page load — should
  // pass it explicitly so "CSVs loaded:" reflects when the export actually
  // happened, not whenever a visitor happens to open the page.
  function regenerate(generatedAt) {
    if (!state.reg) { state.result = null; renderViews(); return; }
    state.result = LOGIC.generate(state.reg.rows, state.act ? state.act.rows : [], {
      regFileName: state.reg.name,
      actFileName: state.act ? state.act.name : "",
      generatedAt: generatedAt || new Date()
    });
    state.sortCol = null; state.sortDir = 1;
    syncSponsorsFromRegistrations();
    renderViews();
  }

  // Any registrant with a nonzero Individual Sponsorship fee becomes a real
  // row in the Sponsors tab (type "individual"), so they're counted in the
  // Summary tab's Individual Sponsors card instead of a separate raw-CSV
  // figure. Insert-only, matched by a stable id — reloading the same CSVs
  // never creates duplicates, and never overwrites a sponsor an officer has
  // since edited by hand (e.g. added a website).
  //
  // The id is derived from Reg Date + name, NOT Member Number: non-member
  // registrants get a Member Number auto-assigned fresh by generate() on
  // every load (see regenerate() -> LOGIC.generate()), and that assignment
  // depends on row order, so the same numeric value could mean a different
  // person on a re-export. Reg Date (the registration transaction's own
  // timestamp) plus name is stable for the same person's same registration
  // across exports, and distinct across different people.
  function csvSponsorId(rec) {
    var raw = String(rec["Reg Date"] || "") + "_" + String(rec["Last Name"] || "") + "_" + String(rec["First Name"] || "");
    return "csvind_" + raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function syncSponsorsFromRegistrations() {
    if (!state.result || !state.result.ok) return;
    var byId = {};
    state.sponsors.forEach(function (s) { byId[s.id] = s; });
    state.result.registrations.forEach(function (rec) {
      if (rec._isWalkIn) return;
      var fee = rec["Individual Sponsorship"];
      if (fee === "" || fee == null || Number(fee) <= 0) return;
      var id = csvSponsorId(rec);
      var existing = byId[id];
      if (existing) {
        // Backfill Reg Date on sponsors synced before that column existed.
        // Safe to patch unconditionally here — unlike every other field,
        // which stays insert-only so an officer's hand-edit (e.g. adding a
        // website) is never overwritten — because Reg Date is derived,
        // system-set data that's never edited by hand.
        if (!existing.regDate && rec["Reg Date"]) {
          var patched = {};
          Object.keys(existing).forEach(function (k) { patched[k] = existing[k]; });
          patched.regDate = rec["Reg Date"];
          byId[id] = patched;
          upsertSponsor(patched);
        }
        return;
      }
      var cityStateZip = [rec["City"], rec["State"]].filter(Boolean).join(", ") + (rec["Zip"] ? " " + rec["Zip"] : "");
      var sponsorName = (rec["Last Name"] || "") + (rec["First Name"] ? ", " + rec["First Name"] : "");
      var isMember = Number(rec["Member Number"]) < CONFIG.firstNonMember;
      upsertSponsor({
        id: id,
        name: sponsorName,
        regDate: rec["Reg Date"] || "",
        contactPerson: "",
        phone: rec["Phone"] || "",
        email: rec["Email"] || "",
        address: [rec["Address"], cityStateZip].filter(Boolean).join(", "),
        website: "",
        etccMemberName: isMember ? sponsorName : "",
        sponsorType: "individual",
        shirtSize: rec._sponsorShirtSize || ""
      });
    });
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
    app.innerHTML = "";
    app.appendChild(buildTabs());

    // Sponsors are manually entered and independent of the loaded CSVs, so
    // this tab works even before the two ClubExpress files have been dropped.
    if (state.tab === "sponsors") {
      app.appendChild(buildSponsorsToolbar());
      app.appendChild(buildSponsorsView());
      return;
    }

    if (!state.result) {
      app.appendChild(el("div", { class: "empty-state" },
        ["Drop the two ClubExpress CSVs above to see " + (state.tab === "sum" ? "the summary." : "the registration list.")]));
      return;
    }
    if (!state.result.ok) {
      app.appendChild(el("div", { class: "panel" }, [
        el("h3", { text: "Could not generate" }),
        el("ul", { class: "messages" }, state.result.messages.map(function (m) { return el("li", { text: m }); }))
      ]));
      return;
    }
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
    return el("div", { class: "tabs no-print" }, [mk("sum", "Summary"), mk("reg", "Registration"), mk("sponsors", "Sponsors")]);
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
    var kids = [
      search,
      el("label", {}, [wk, document.createTextNode(" walk-ins")]),
      statusGroup,
      count,
      el("span", { class: "spacer" }),
      zoomGroup
    ];
    // On the hosted site, CSVs are always loaded server-side (see index.php) and
    // there's no reason to re-export what the app already reads live — both
    // buttons stay for the offline tool, which has no other way to load data
    // or get a workbook out.
    if (!LIVE) kids.push(buildChangeFilesBtn());
    kids.push(prn);
    if (!LIVE) {
      var xls = el("button", { class: "btn primary" }, ["⬇ Download Excel"]);
      xls.addEventListener("click", function () { downloadExcel(); });
      kids.push(xls);
    }
    return el("div", { class: "toolbar no-print" }, kids);
  }
  function buildSummaryToolbar() {
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", function () { clearPrintHost(); window.print(); });
    var kids = [el("span", { class: "spacer" })];
    if (!LIVE) kids.push(buildChangeFilesBtn());
    kids.push(prn);
    if (!LIVE) {
      var xls = el("button", { class: "btn primary" }, ["⬇ Download Excel"]);
      xls.addEventListener("click", function () { downloadExcel(); });
      kids.push(xls);
    }
    return el("div", { class: "toolbar no-print" }, kids);
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
  // modal). Individual Sponsorship stays visible here (unlike the Summary tab's
  // card, which was removed) even though those registrants are also synced into
  // the Sponsors tab (see syncSponsorsFromRegistrations) — both views are kept
  // in sync from the same CSV data. The Excel export is unaffected and still
  // lists everything, including all 24 individual shirt buckets, since that
  // detail matters for ordering shirts even though it's noise on screen.
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
    { title: "Vehicle", cols: ["Year", "Model", "Color", "Gen", "In Car Show?"] }
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
      card("Next Member #", s.nextMemberNumber)
    ]));

    // sponsor cards (independent of the loaded CSVs — reads state.sponsors directly)
    container.appendChild(el("div", { class: "panel" }, [
      el("h3", { text: "Sponsors" }),
      el("div", { class: "cards sponsor-cards" }, [
        sponsorSummaryCard("individual"), sponsorSummaryCard("corporate"), sponsorSummaryCard("premier")
      ])
    ]));

    // shirts matrices — registration-only, plus a combined (registration +
    // sponsor) matrix — as a pair of cards side by side, same "cards
    // sponsor-cards" / "sponsor-card" styling as the Sponsors panel above
    // (compact table font/padding included) so both panels read as one system.
    container.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "cards sponsor-cards" }, [
        el("div", { class: "sponsor-card" }, [el("div", { class: "sponsor-card-head", text: "Registration Shirts" }), shirtMatrix(s)]),
        el("div", { class: "sponsor-card" }, [el("div", { class: "sponsor-card-head", text: "Total Shirts Needed For Event" }), combinedShirtMatrix(s)])
      ])
    ]));

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
  // Every sponsor of any type picks one shirt (no Free/Xtra distinction like
  // registrants — see CONFIG.SPONSOR_SIZE_INDEX), so this tallies all of
  // state.sponsors regardless of sponsorType, unlike sponsorStatsByType()
  // which is per-type for the Sponsors summary cards.
  function allSponsorShirtCounts() {
    var counts = {};
    CONFIG.SIZES.forEach(function (sz) { counts[sz.key] = { mens: 0, womens: 0 }; });
    state.sponsors.forEach(function (sp) {
      var info = sp.shirtSize && CONFIG.SPONSOR_SIZE_INDEX[sp.shirtSize];
      if (!info || !counts[info.sizeKey]) return;
      if (info.gender === "Men's") counts[info.sizeKey].mens++; else counts[info.sizeKey].womens++;
    });
    return counts;
  }
  // Registration shirts (Free+Xtra collapsed to just gender) plus sponsor
  // shirts, per size — the "how many actual shirts of each size do we need"
  // number, as opposed to the registration-only breakdown in shirtMatrix().
  function combinedShirtMatrix(s) {
    var C = CONFIG;
    var sponsorCounts = allSponsorShirtCounts();
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" }), el("th", { text: "Men's" }), el("th", { text: "Women's" })]);
    var body = C.SIZES.map(function (sz) {
      var regMens = 0, regWomens = 0;
      C.GROUPS.forEach(function (g) {
        var val = s.shirtTotals[g.key + sz.key] || 0;
        if (g.gender === "Men's") regMens += val; else regWomens += val;
      });
      var mens = regMens + sponsorCounts[sz.key].mens;
      var womens = regWomens + sponsorCounts[sz.key].womens;
      return el("tr", {}, [
        el("td", { class: "lbl", text: sz.label }),
        el("td", { class: mens ? "" : "z", text: String(mens) }),
        el("td", { class: womens ? "" : "z", text: String(womens) })
      ]);
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

  // ---------- sponsors ----------
  // Manually entered/edited, stored in localStorage — not derived from the CSV
  // exports, so this tab (and its data) is independent of whatever registration
  // data happens to be loaded.
  var SPONSOR_COLS = [
    { key: "name", label: "Sponsor Name" },
    { key: "regDate", label: "Reg Date" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "website", label: "Website" },
    { key: "etccMemberName", label: "ETCC Member Name" },
    { key: "sponsorType", label: "Sponsor Type" },
    { key: "shirtSize", label: "T-Shirt" }
  ];
  function sponsorTypeLabel(key) {
    var t = CONFIG.SPONSOR_TYPES.filter(function (x) { return x.key === key; })[0];
    return t ? t.label : (key || "");
  }

  // Per-type totals + shirt-size breakdown for the Summary tab's sponsor cards.
  // Each sponsor picks exactly one shirt (no free/xtra quantities like
  // registrants), so this just tallies which of the 12 sizes each sponsor of
  // this type chose.
  function sponsorStatsByType(typeKey) {
    var typeCfg = CONFIG.SPONSOR_TYPES.filter(function (t) { return t.key === typeKey; })[0];
    var matches = state.sponsors.filter(function (s) { return s.sponsorType === typeKey; });
    var sizeCounts = {};
    CONFIG.SIZES.forEach(function (sz) { sizeCounts[sz.key] = { mens: 0, womens: 0 }; });
    matches.forEach(function (s) {
      var info = s.shirtSize && CONFIG.SPONSOR_SIZE_INDEX[s.shirtSize];
      if (!info || !sizeCounts[info.sizeKey]) return;
      if (info.gender === "Men's") sizeCounts[info.sizeKey].mens++; else sizeCounts[info.sizeKey].womens++;
    });
    return {
      label: typeCfg ? typeCfg.label.replace(/\s*\(\$[\d,]+\)\s*$/, "") : typeKey,
      count: matches.length,
      total: matches.length * (typeCfg ? typeCfg.fee : 0),
      sizeCounts: sizeCounts
    };
  }

  function sponsorSummaryCard(typeKey) {
    var stats = sponsorStatsByType(typeKey);
    var rows = CONFIG.SIZES.map(function (sz) {
      var c = stats.sizeCounts[sz.key];
      return el("tr", {}, [
        el("td", { class: "lbl", text: sz.label }),
        el("td", { class: c.mens ? "" : "z", text: String(c.mens) }),
        el("td", { class: c.womens ? "" : "z", text: String(c.womens) })
      ]);
    });
    var table = el("table", { class: "matrix" }, [
      el("thead", {}, [el("tr", {}, [el("th", { class: "lbl", text: "Size" }), el("th", { text: "Men's" }), el("th", { text: "Women's" })])]),
      el("tbody", {}, rows)
    ]);
    return el("div", { class: "sponsor-card" }, [
      el("div", { class: "sponsor-card-head", text: stats.label + " Sponsors" }),
      el("div", { class: "sponsor-card-stats" }, [
        el("div", {}, [el("div", { class: "stat-v", text: String(stats.count) }), el("div", { class: "stat-k", text: stats.count === 1 ? "Sponsor" : "Sponsors" })]),
        el("div", {}, [el("div", { class: "stat-v", text: "$" + stats.total.toLocaleString() }), el("div", { class: "stat-k", text: "Total" })])
      ]),
      table
    ]);
  }
  function sponsorFieldText(s, colKey) {
    if (colKey === "sponsorType") return sponsorTypeLabel(s.sponsorType);
    // regDate isn't a single stored field — it depends on where the sponsor
    // came from: the CSV auto-sync stores the registration's own "Reg Date"
    // (already a formatted string, see syncSponsorsFromRegistrations), while
    // a "Become a Car Show Sponsor" web submission has no CSV row at all, so
    // it uses sponsor-form.php's submittedAt (ISO string) instead, formatted
    // to match. Manually-added sponsors with neither show blank.
    if (colKey === "regDate") {
      if (s.regDate) return String(s.regDate);
      if (s.submittedAt) return fmtDate(s.submittedAt);
      return "";
    }
    var v = s[colKey];
    return v == null ? "" : String(v);
  }
  function sortedSponsors() {
    return state.sponsors.slice().sort(function (a, b) {
      var an = (a.name || "").toLowerCase(), bn = (b.name || "").toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }
  function visibleSponsors() {
    var q = state.sponsorSearch.trim().toLowerCase();
    var list = sortedSponsors().filter(function (s) { return state.sponsorTypeFilter[s.sponsorType] !== false; });
    if (!q) return list;
    return list.filter(function (s) {
      return SPONSOR_COLS.some(function (c) { return sponsorFieldText(s, c.key).toLowerCase().indexOf(q) !== -1; });
    });
  }
  // Local state is updated optimistically either way; in LIVE mode the write
  // additionally (asynchronously) goes to the server instead of localStorage —
  // every officer viewing the hosted site reads that same server copy on
  // their next page load, so no separate Import step is needed there.
  function upsertSponsor(record) {
    var idx = -1;
    state.sponsors.forEach(function (s, i) { if (s.id === record.id) idx = i; });
    if (idx === -1) state.sponsors.push(record); else state.sponsors[idx] = record;
    if (LIVE) pushSponsorToServer("upsert", { sponsor: record });
    else saveSponsors(state.sponsors);
  }
  function removeSponsor(id) {
    state.sponsors = state.sponsors.filter(function (s) { return s.id !== id; });
    if (LIVE) pushSponsorToServer("delete", { id: id });
    else saveSponsors(state.sponsors);
  }

  // ---------- row selection (Sponsors tab checkboxes) ----------
  function selectedSponsorIds() { return Object.keys(state.sponsorSelected); }
  function setSponsorSelected(id, checked) {
    if (checked) state.sponsorSelected[id] = true; else delete state.sponsorSelected[id];
  }
  function toggleSelectAllSponsors(checked) {
    visibleSponsors().forEach(function (s) { setSponsorSelected(s.id, checked); });
    renderSponsorsBody();
  }
  // Removes every selected sponsor the same way the single-delete path does
  // (one removeSponsor() call per id — no batch endpoint exists on the server,
  // and at this club's scale a handful of sequential fire-and-forget deletes
  // is an acceptable tradeoff versus adding one).
  function deleteSelectedSponsors() {
    selectedSponsorIds().forEach(function (id) { removeSponsor(id); });
    state.sponsorSelected = {};
    renderViews();
  }
  // Fire-and-forget (with a visible failure indicator) rather than blocking the
  // UI on a round-trip — the local list already reflects the change immediately.
  // No re-fetch/merge afterward: two officers editing at the exact same moment
  // is rare enough for this club-sized app that "last write wins, reload to see
  // others' changes" is an acceptable tradeoff versus building real-time sync.
  function pushSponsorToServer(action, payload) {
    if (!LIVE || !LIVE.sponsorsApiUrl) return;
    var body = { action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    fetch(LIVE.sponsorsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.sponsorSyncError = null;
      if (state.tab === "sponsors") renderViews();
    }).catch(function () {
      state.sponsorSyncError = "Could not save that change to the server — check your connection and try again.";
      if (state.tab === "sponsors") renderViews();
    });
  }

  // ---------- remove all sponsors ----------
  function openClearSponsorsConfirm() { state.clearSponsorsOpen = true; renderClearSponsorsConfirm(); }
  function closeClearSponsorsConfirm() { state.clearSponsorsOpen = false; renderClearSponsorsConfirm(); }
  function clearAllSponsors() {
    state.sponsors = [];
    if (LIVE) {
      fetch(LIVE.sponsorsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" })
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        state.sponsorSyncError = null;
        if (state.tab === "sponsors") renderViews();
      }).catch(function () {
        state.sponsorSyncError = "Could not clear sponsors on the server — check your connection and try again.";
        if (state.tab === "sponsors") renderViews();
      });
    } else {
      saveSponsors(state.sponsors);
    }
    renderViews();
  }
  function renderClearSponsorsConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.clearSponsorsOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeClearSponsorsConfirm);
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Remove All Sponsors?" }), el("span", { class: "spacer" }), closeBtn]);

    var count = state.sponsors.length;
    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" },
      ["Yes, Remove All"]);
    yesBtn.addEventListener("click", function () { closeClearSponsorsConfirm(); clearAllSponsors(); });
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeClearSponsorsConfirm);

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This permanently removes all " + count + " sponsor" + (count === 1 ? "" : "s") +
        (LIVE ? " from the server" : "") + ". This cannot be undone."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ]);

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeClearSponsorsConfirm);
    host.appendChild(backdrop);
  }

  // ---------- delete selected sponsors ----------
  function openDeleteSelectedConfirm() {
    if (!selectedSponsorIds().length) return;
    state.deleteSelectedOpen = true;
    renderDeleteSelectedConfirm();
  }
  function closeDeleteSelectedConfirm() { state.deleteSelectedOpen = false; renderDeleteSelectedConfirm(); }
  function renderDeleteSelectedConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.deleteSelectedOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeleteSelectedConfirm);
    var count = selectedSponsorIds().length;
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Delete " + count + " Sponsor" + (count === 1 ? "" : "s") + "?" }), el("span", { class: "spacer" }), closeBtn]);

    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" },
      ["Yes, Delete"]);
    yesBtn.addEventListener("click", function () { closeDeleteSelectedConfirm(); deleteSelectedSponsors(); });
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeDeleteSelectedConfirm);

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This permanently removes the " + count + " selected sponsor" + (count === 1 ? "" : "s") +
        (LIVE ? " from the server" : "") + ". This cannot be undone."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ]);

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDeleteSelectedConfirm);
    host.appendChild(backdrop);
  }

  function buildSponsorsToolbar() {
    var search = el("input", { type: "search", placeholder: "Search sponsors…", value: state.sponsorSearch });
    search.addEventListener("input", function () { state.sponsorSearch = search.value; renderSponsorsBody(); });
    var typeGroup = el("span", { class: "statusgroup" }, CONFIG.SPONSOR_TYPES.map(function (t) {
      var cb = el("input", { type: "checkbox" }); cb.checked = state.sponsorTypeFilter[t.key];
      cb.addEventListener("change", function () { state.sponsorTypeFilter[t.key] = cb.checked; renderSponsorsBody(); });
      var label = t.label.replace(/\s*\(\$[\d,]+\)\s*$/, "");
      return el("label", {}, [cb, document.createTextNode(" " + label)]);
    }));
    var count = el("span", { class: "count", id: "sponsorcount" });
    // Adding a sponsor goes through the same public "Become a Car Show
    // Sponsor" form (sponsor-form.php) anyone else uses, instead of the
    // in-app modal — keeps one path for entries to land in
    // sponsor-submissions.json.
    var addBtn = el("button", { class: "btn primary" }, ["+ Add Sponsor"]);
    addBtn.addEventListener("click", function () { window.open("sponsor-form.php", "_blank", "noopener"); });
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", printSponsors);
    var delBtn = el("button", { class: "btn", id: "sponsorDeleteBtn", disabled: "disabled" }, ["🗑 Delete"]);
    delBtn.addEventListener("click", openDeleteSelectedConfirm);
    var kids = [search, typeGroup, count, el("span", { class: "spacer" })];
    if (LIVE) {
      // Always current already — every edit here already went to the server,
      // so there's nothing to pull; a manual Import step would be redundant.
      kids.push(el("span", { class: "count", title: "This list is read from and saved straight to the server." }, ["🔄 Live"]));
    } else {
      var importBtn = el("button", { class: "btn" }, ["⇩ Import from Server"]);
      importBtn.addEventListener("click", openImportModal);
      kids.push(importBtn);
    }
    kids.push(prn, delBtn, addBtn);
    return el("div", { class: "toolbar no-print" }, kids);
  }

  function buildSponsorsView() {
    var container = el("div", { class: "view" });
    if (state.sponsorSyncError) {
      container.appendChild(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.sponsorSyncError]));
    }
    var selectAllCb = el("input", { type: "checkbox", id: "sponsorSelectAll", title: "Select all" });
    selectAllCb.addEventListener("change", function () { toggleSelectAllSponsors(selectAllCb.checked); });
    var thead = el("thead", {}, [el("tr", {}, [el("th", { class: "no-print" }, [selectAllCb])]
      .concat(SPONSOR_COLS.map(function (c) { return el("th", { text: c.label }); }))
      .concat([el("th", { class: "no-print", text: "" })]))]);
    var table = el("table", { class: "grid" }, [thead, el("tbody", { id: "sponsorbody" })]);
    container.appendChild(el("div", { class: "tablewrap" }, [table]));
    setTimeout(renderSponsorsBody, 0);
    return container;
  }

  function renderSponsorsBody() {
    if (state.tab !== "sponsors") return;
    var body = $("#sponsorbody"); if (!body) return;
    var rows = visibleSponsors();
    var frag = document.createDocumentFragment();
    rows.forEach(function (s) {
      var tr = el("tr", {});
      tr.title = "Click for full details";
      tr.addEventListener("click", function () { openSponsorForm(s); });
      var cb = el("input", { type: "checkbox" });
      cb.checked = !!state.sponsorSelected[s.id];
      cb.addEventListener("click", function (e) { e.stopPropagation(); });
      cb.addEventListener("change", function () { setSponsorSelected(s.id, cb.checked); renderSponsorsBody(); });
      tr.appendChild(el("td", { class: "no-print" }, [cb]));
      SPONSOR_COLS.forEach(function (c) { tr.appendChild(el("td", { text: sponsorFieldText(s, c.key) })); });
      tr.appendChild(el("td", { class: "no-print" }));
      frag.appendChild(tr);
    });
    body.innerHTML = "";
    body.appendChild(frag);
    var rc = $("#sponsorcount");
    if (rc) rc.textContent = rows.length + " of " + state.sponsors.length + " sponsors shown";
    if (!state.sponsors.length) {
      body.appendChild(el("tr", {}, [el("td", { class: "hint", colspan: String(SPONSOR_COLS.length + 2), text: "No sponsors yet — click “+ Add Sponsor” to add one." })]));
    }
    var selectAllCb = $("#sponsorSelectAll");
    if (selectAllCb) {
      var visibleIds = rows.map(function (s) { return s.id; });
      var selectedVisible = visibleIds.filter(function (id) { return state.sponsorSelected[id]; });
      selectAllCb.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      selectAllCb.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    }
    var delBtn = $("#sponsorDeleteBtn");
    if (delBtn) {
      var n = selectedSponsorIds().length;
      delBtn.textContent = "🗑 Delete" + (n ? " (" + n + ")" : "");
      if (n) delBtn.removeAttribute("disabled"); else delBtn.setAttribute("disabled", "disabled");
    }
  }

  // ---------- sponsor add/edit form modal ----------
  var SPONSOR_FORM_FIELDS = [
    { key: "name", label: "Sponsor Name", required: true },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "website", label: "Website" },
    { key: "etccMemberName", label: "ETCC Member Name" }
  ];
  function blankSponsor() {
    return {
      id: null, name: "", contactPerson: "", phone: "", email: "", address: "", website: "",
      etccMemberName: "", sponsorType: CONFIG.SPONSOR_TYPES[0].key, shirtSize: ""
    };
  }
  function openSponsorForm(sponsor) {
    var src = sponsor || blankSponsor();
    var copy = {};
    Object.keys(src).forEach(function (k) { copy[k] = src[k]; });
    state.sponsorEditing = copy;
    renderSponsorFormModal();
  }
  function closeSponsorForm() { state.sponsorEditing = null; renderSponsorFormModal(); }

  function renderSponsorFormModal() {
    var host = $("#sponsorFormHost");
    if (!host) return;
    host.innerHTML = "";
    var editing = state.sponsorEditing;
    if (!editing) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeSponsorForm);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: editing.id ? "Edit Sponsor" : "Add Sponsor" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var body = el("div", { class: "modal-body" });
    var fieldEls = {};
    SPONSOR_FORM_FIELDS.forEach(function (f) {
      var input = el("input", { type: "text", value: editing[f.key] || "" });
      fieldEls[f.key] = input;
      body.appendChild(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: f.label + (f.required ? " *" : "") }),
        input
      ]));
    });

    var typeSel = el("select", {});
    CONFIG.SPONSOR_TYPES.forEach(function (t) {
      var o = el("option", { value: t.key, text: t.label });
      if (editing.sponsorType === t.key) o.setAttribute("selected", "selected");
      typeSel.appendChild(o);
    });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Sponsor Type" }), typeSel]));

    var shirtSel = el("select", {});
    shirtSel.appendChild(el("option", { value: "", text: "— none —" }));
    CONFIG.SPONSOR_SHIRT_SIZES.forEach(function (sz) {
      var o = el("option", { value: sz, text: sz });
      if (editing.shirtSize === sz) o.setAttribute("selected", "selected");
      shirtSel.appendChild(o);
    });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "T-Shirt" }), shirtSel]));

    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () {
      var name = fieldEls.name.value.trim();
      if (!name) { errorMsg.textContent = "Sponsor Name is required."; return; }
      var record = {
        id: editing.id || ("sp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
        name: name,
        // Not editable here — carried through so editing a sponsor's contact
        // info doesn't blank out its Reg Date column (see sponsorFieldText).
        regDate: editing.regDate || "",
        submittedAt: editing.submittedAt,
        contactPerson: fieldEls.contactPerson.value.trim(),
        phone: fieldEls.phone.value.trim(),
        email: fieldEls.email.value.trim(),
        address: fieldEls.address.value.trim(),
        website: fieldEls.website.value.trim(),
        etccMemberName: fieldEls.etccMemberName.value.trim(),
        sponsorType: typeSel.value,
        shirtSize: shirtSel.value
      };
      upsertSponsor(record);
      closeSponsorForm();
      renderSponsorsBody();
    });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closeSponsorForm);
    var actions = [saveBtn, cancelBtn];
    if (editing.id) {
      var delBtn = el("button", { class: "btn", style: "color:var(--warn)" }, ["Delete"]);
      delBtn.addEventListener("click", function () {
        removeSponsor(editing.id);
        closeSponsorForm();
        renderSponsorsBody();
      });
      actions.push(delBtn);
    }
    body.appendChild(el("div", { class: "settings-actions" }, actions));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeSponsorForm);
    host.appendChild(backdrop);
  }

  // ---------- import sponsors submitted through the public web form ----------
  // Pulls sponsor-submissions.php (password-protected, see App/deploy/README.md)
  // and merges any records not already present locally (matched by id) into
  // state.sponsors. This is the offline tool's only path to see submissions
  // from deploy/sponsor-form.php, since it has no shared session cross-origin.
  function openImportModal() { state.importOpen = true; renderImportModal(); }
  function closeImportModal() { state.importOpen = false; renderImportModal(); }

  function renderImportModal() {
    var host = $("#importHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.importOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeImportModal);
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Import from Server" }), el("span", { class: "spacer" }), closeBtn]);

    var urlInput = el("input", { type: "text", value: DEFAULT_IMPORT_URL });
    var pwInput = el("input", { type: "password", value: "" });
    var statusMsg = el("div", { class: "form-error" });

    var body = el("div", { class: "modal-body" }, [
      el("div", { class: "hint", style: "margin-bottom:10px" },
        ["Pulls sponsorships submitted through the public web form into this browser's Sponsors list. Requires the site password."]),
      el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Server URL" }), urlInput]),
      el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Site Password" }), pwInput]),
      statusMsg
    ]);

    var importBtn = el("button", { class: "btn primary" }, ["Import"]);
    importBtn.addEventListener("click", function () {
      var url = urlInput.value.trim();
      var pw = pwInput.value;
      statusMsg.style.color = "var(--warn)";
      if (!url) { statusMsg.textContent = "Server URL is required."; return; }
      if (!pw) { statusMsg.textContent = "Password is required."; return; }
      statusMsg.textContent = "";
      importBtn.setAttribute("disabled", "disabled");
      importBtn.textContent = "Importing…";
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        importBtn.removeAttribute("disabled");
        importBtn.textContent = "Import";
        if (!r.ok || !r.data || !r.data.ok) {
          statusMsg.style.color = "var(--warn)";
          statusMsg.textContent = (r.data && r.data.error) ? r.data.error : "Import failed.";
          return;
        }
        var incoming = r.data.sponsors || [];
        var existingIds = {};
        state.sponsors.forEach(function (s) { existingIds[s.id] = true; });
        var added = 0;
        incoming.forEach(function (s) {
          if (s && s.id && !existingIds[s.id]) { state.sponsors.push(s); existingIds[s.id] = true; added++; }
        });
        if (added) saveSponsors(state.sponsors);
        statusMsg.style.color = "var(--good)";
        statusMsg.textContent = added
          ? "Imported " + added + " new sponsor" + (added === 1 ? "" : "s") + "."
          : "No new submissions to import.";
        renderSponsorsBody();
      }).catch(function () {
        importBtn.removeAttribute("disabled");
        importBtn.textContent = "Import";
        statusMsg.style.color = "var(--warn)";
        statusMsg.textContent = "Could not reach the server. Check the URL and your connection.";
      });
    });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closeImportModal);
    body.appendChild(el("div", { class: "settings-actions" }, [importBtn, cancelBtn]));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeImportModal);
    host.appendChild(backdrop);
  }

  // Print-only table (mirrors the on-screen columns; sponsors don't have the
  // Registration tab's 24-shirt-column collapsing problem, so no separate
  // "full column" build is needed the way printRegistration() has).
  function printSponsors() {
    var host = $("#printHost");
    host.innerHTML = "";
    var thead = el("thead", {}, [el("tr", {}, SPONSOR_COLS.map(function (c) { return el("th", { text: c.label }); }))]);
    var tbody = el("tbody", {}, visibleSponsors().map(function (s) {
      return el("tr", {}, SPONSOR_COLS.map(function (c) { return el("td", { text: sponsorFieldText(s, c.key) }); }));
    }));
    host.appendChild(el("h2", { text: "Car Show Sponsors" }));
    host.appendChild(el("table", { class: "grid" }, [thead, tbody]));
    window.print();
  }

  function fmtDate(d) {
    d = d instanceof Date ? d : new Date(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + h + ":" + p(d.getMinutes()) + " " + ap;
  }

  // ---------- Excel export (ExcelJS) ----------
  function downloadExcel() {
    var res = state.result && state.result.ok ? state.result : null;
    if (!res && !state.sponsors.length) return;
    var wb = window.CarShowExcel.build(ExcelJS, res, state.sponsors);
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

  // ---------- header menu (hamburger) / settings ----------
  // Order (LIVE mode): Logout, Developer (password-gated — reveals Import
  // Members / Import Registrations once unlocked), Settings, Become a Car
  // Show Sponsor. Offline tool only ever has Settings — everything else here
  // needs the hosted site's session/server.
  function buildHeaderMenu() {
    var header = $("header.app");
    if (!header) return;
    // SilentAuctionManager-style: 3-bar icon (animates into an X via the
    // .open class), sitting at the far left of the header, opening a
    // fixed off-canvas drawer from the left with a backdrop — see
    // .hamburger-btn/.hdr-nav-backdrop/.hdr-menu in styles.css.
    var hamburgerBtn = el("button", { id: "hamburgerBtn", class: "hamburger-btn", title: "Menu", "aria-label": "Menu", "aria-expanded": "false" }, [
      el("span", { class: "bar" }), el("span", { class: "bar" }), el("span", { class: "bar" })
    ]);
    hamburgerBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
    header.insertBefore(hamburgerBtn, header.firstChild);

    var backdrop = el("div", { id: "hdrNavBackdrop", class: "hdr-nav-backdrop" });
    backdrop.addEventListener("click", closeMenu);
    var menu = el("div", { id: "hdrMenu", class: "hdr-menu" });
    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
    document.addEventListener("click", closeMenu);
    renderHeaderMenu();
  }
  function toggleMenu() { state.menuOpen = !state.menuOpen; renderHeaderMenu(); }
  function closeMenu() {
    if (!state.menuOpen && !state.developerOpen) return;
    state.menuOpen = false;
    state.developerOpen = false;
    state.developerError = null;
    renderHeaderMenu();
  }
  // Client-side gate reusing the site's existing login endpoint (action=login
  // on location.pathname — the same request _login.html's JS makes) to check
  // the entered password without ever exposing the hash to this script. Every
  // Import Members/Registrations link is still independently session-gated
  // server-side (see members-import.php/registrations-import.php) — this
  // step is only about hiding those links from the menu until asked for.
  function submitDeveloperPassword(password) {
    return fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "action=login&password=" + encodeURIComponent(password)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.success) {
          state.developerUnlocked = true;
          state.developerOpen = false;
          state.developerError = null;
        } else {
          state.developerError = "Incorrect password.";
        }
        renderHeaderMenu();
      })
      .catch(function () {
        state.developerError = "Could not verify — check your connection and try again.";
        renderHeaderMenu();
      });
  }
  function buildDeveloperMenuItems() {
    if (state.developerUnlocked) {
      var importMembers = el("a", { class: "hdr-menu-item", href: "members-import.php", target: "_blank", rel: "noopener" }, ["👥 Import Members"]);
      importMembers.addEventListener("click", closeMenu);
      var importRegs = el("a", { class: "hdr-menu-item", href: "registrations-import.php", target: "_blank", rel: "noopener" }, ["📋 Import Registrations"]);
      importRegs.addEventListener("click", closeMenu);
      return [importMembers, importRegs];
    }
    if (!state.developerOpen) {
      var devBtn = el("button", { class: "hdr-menu-item" }, ["🛠 Developer"]);
      devBtn.addEventListener("click", function (e) { e.stopPropagation(); state.developerOpen = true; renderHeaderMenu(); });
      return [devBtn];
    }
    var pwInput = el("input", { type: "password", class: "hdr-dev-pw", placeholder: "Developer password" });
    var goBtn = el("button", { class: "btn" }, ["Unlock"]);
    var submit = function () { submitDeveloperPassword(pwInput.value); };
    goBtn.addEventListener("click", function (e) { e.stopPropagation(); submit(); });
    pwInput.addEventListener("click", function (e) { e.stopPropagation(); });
    pwInput.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") submit(); });
    var out = [el("div", { class: "hdr-menu-item hdr-dev-row" }, [pwInput, goBtn])];
    if (state.developerError) out.push(el("div", { class: "hdr-dev-error" }, [state.developerError]));
    return out;
  }
  function renderHeaderMenu() {
    var menu = $("#hdrMenu");
    if (!menu) return;
    var backdrop = $("#hdrNavBackdrop");
    var btn = $("#hamburgerBtn");
    menu.classList.toggle("open", state.menuOpen);
    if (backdrop) backdrop.classList.toggle("open", state.menuOpen);
    if (btn) {
      btn.classList.toggle("open", state.menuOpen);
      btn.setAttribute("aria-expanded", state.menuOpen ? "true" : "false");
    }
    menu.innerHTML = "";
    var items = [];
    if (LIVE) {
      var logoutItem = el("a", { class: "hdr-menu-item", href: "logout.php" }, ["🚪 Logout"]);
      logoutItem.addEventListener("click", closeMenu);
      items.push(logoutItem);
      items = items.concat(buildDeveloperMenuItems());
    } else {
      // Settings (regression tests, zoom presets) has no LIVE-mode equivalent
      // need — Logout/Developer replaced it there; the offline tool still
      // needs a way to reach it.
      var settingsItem = el("button", { id: "settingsMenuItem", class: "hdr-menu-item" }, ["⚙ Settings"]);
      settingsItem.addEventListener("click", function () { closeMenu(); openSettings(); });
      items.push(settingsItem);
    }
    items.forEach(function (it) { menu.appendChild(it); });
    if (state.menuOpen && state.developerOpen && !state.developerUnlocked) {
      var pw = menu.querySelector(".hdr-dev-pw");
      if (pw) pw.focus();
    }
  }

  function openSettings() { state.settingsOpen = true; renderSettingsModal(); }
  function closeSettings() { state.settingsOpen = false; renderSettingsModal(); }

  // Runs the same fixture-based assertions as test/run-tests.js, entirely in
  // this tab (src/regression-tests.js + embedded fixture CSVs, both baked
  // into the build) — it never touches whatever CSVs the user currently has
  // loaded, since it works on its own copy of reg/act rows.
  function runRegressionTests() {
    if (!window.CarShowRegressionTests || !window.CarShowFixtures) {
      state.testResults = { results: [{ label: "Regression test module not available in this build", ok: false, expected: "available", actual: "missing" }], passed: 0, failed: 1 };
      renderSettingsModal();
      return;
    }
    state.testRunning = true;
    renderSettingsModal();
    var F = window.CarShowFixtures;
    var reg = Papa.parse(F.regCsv, { header: true, skipEmptyLines: true }).data;
    var act = Papa.parse(F.actCsv, { header: true, skipEmptyLines: true }).data;
    var built = window.CarShowRegressionTests.assertionList(reg, act);
    return window.CarShowRegressionTests.excelAssertionList(built.out, ExcelJS).then(function (excelResults) {
      var all = built.results.concat(excelResults);
      var passed = all.filter(function (r) { return r.ok; }).length;
      state.testResults = { results: all, passed: passed, failed: all.length - passed };
      state.testRunning = false;
      renderSettingsModal();
    }).catch(function (err) {
      state.testResults = { results: built.results.concat([{ label: "Excel round-trip threw", ok: false, expected: "no throw", actual: String(err && err.message || err) }]), passed: 0, failed: 1 };
      state.testRunning = false;
      renderSettingsModal();
    });
  }

  function renderSettingsModal() {
    var host = $("#settingsHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.settingsOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeSettings);
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Settings" }), el("span", { class: "spacer" }), closeBtn]);

    var runBtn = el("button", { class: "btn primary" }, [state.testRunning ? "Running…" : "Run Regression Tests"]);
    if (state.testRunning) runBtn.setAttribute("disabled", "disabled");
    runBtn.addEventListener("click", runRegressionTests);

    var onlyErrCb = el("input", { type: "checkbox" });
    onlyErrCb.checked = state.testOnlyErrors;
    onlyErrCb.addEventListener("change", function () { state.testOnlyErrors = onlyErrCb.checked; renderSettingsModal(); });
    var onlyErrLabel = el("label", {}, [onlyErrCb, document.createTextNode(" Only show errors")]);

    var body = el("div", { class: "modal-body" }, [
      el("h4", { text: "Regression Tests" }),
      el("div", { class: "hint", style: "margin-bottom:4px" }, ["Runs this app's fixture-based test suite in this tab. It uses its own sample data and never touches whatever CSVs you currently have loaded."]),
      el("div", { class: "settings-actions" }, [runBtn, onlyErrLabel])
    ]);

    if (state.testResults) {
      var r = state.testResults;
      var summaryCls = r.failed === 0 ? "good" : "warn";
      body.appendChild(el("div", { class: "test-summary " + summaryCls }, [r.passed + " passed, " + r.failed + " failed"]));
      var shown = state.testOnlyErrors ? r.results.filter(function (t) { return !t.ok; }) : r.results;
      if (!shown.length) {
        body.appendChild(el("div", { class: "hint" }, [state.testOnlyErrors ? "No errors — all checks passed." : "No results."]));
      } else {
        body.appendChild(el("ul", { class: "test-list" }, shown.map(function (t) {
          var kids = [(t.ok ? "✓ " : "✗ ") + t.label];
          if (!t.ok) kids.push(el("div", { class: "expect" }, ["expected " + JSON.stringify(t.expected) + " — got " + JSON.stringify(t.actual)]));
          return el("li", { class: t.ok ? "pass" : "fail" }, kids);
        })));
      }
    }

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeSettings);
    host.appendChild(backdrop);
  }

  function init() {
    document.body.appendChild(el("div", { id: "detailHost" }));
    document.body.appendChild(el("div", { id: "printHost" }));
    document.body.appendChild(el("div", { id: "settingsHost" }));
    document.body.appendChild(el("div", { id: "sponsorFormHost" }));
    document.body.appendChild(el("div", { id: "importHost" }));
    document.body.appendChild(el("div", { id: "confirmHost" }));
    // window.__carshowLive is set (by index.php, before this script runs) only
    // when served from the hosted site — see the LIVE comment near its
    // declaration above. Read it here, not at module-load time, since init()
    // is what's guaranteed to run after every inline script in the document.
    LIVE = window.__carshowLive || null;
    state.sponsors = LIVE ? [] : loadSponsors(); // LIVE mode: filled by ingestSponsors() instead
    buildHeaderMenu();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.settingsOpen) { closeSettings(); return; }
      if (e.key === "Escape" && state.sponsorEditing) { closeSponsorForm(); return; }
      if (e.key === "Escape" && state.importOpen) { closeImportModal(); return; }
      if (e.key === "Escape" && state.clearSponsorsOpen) { closeClearSponsorsConfirm(); return; }
      if (e.key === "Escape" && state.deleteSelectedOpen) { closeDeleteSelectedConfirm(); return; }
      if (e.key === "Escape" && state.menuOpen) { closeMenu(); return; }
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
    ingestRows: function (regRows, actRows, generatedAt) {
      state.reg = { name: "registration.csv", rows: regRows };
      state.act = actRows ? { name: "activity.csv", rows: actRows } : null;
      finishIngest([], generatedAt);
    },
    // Called by index.php's boot script (LIVE mode only) with the sponsor list
    // read fresh from the server on this page load — bypasses localStorage
    // entirely, same as the fixture-loading hooks below bypass file I/O.
    ingestSponsors: function (list) {
      state.sponsors = Array.isArray(list) ? list : [];
      renderViews();
    },
    showDropZone: showDropZone,
    setTab: function (t) { state.tab = t; renderViews(); },
    setSearch: function (q) { state.search = q; renderRegBody(); },
    openDetail: openDetail,
    closeDetail: closeDetail,
    stepDetail: stepDetail,
    openSettings: openSettings,
    closeSettings: closeSettings,
    runRegressionTests: runRegressionTests,
    openSponsorForm: openSponsorForm,
    closeSponsorForm: closeSponsorForm,
    openImportModal: openImportModal,
    closeImportModal: closeImportModal,
    openClearSponsorsConfirm: openClearSponsorsConfirm,
    closeClearSponsorsConfirm: closeClearSponsorsConfirm,
    clearAllSponsors: clearAllSponsors,
    setSponsorSelected: setSponsorSelected,
    toggleSelectAllSponsors: toggleSelectAllSponsors,
    openDeleteSelectedConfirm: openDeleteSelectedConfirm,
    closeDeleteSelectedConfirm: closeDeleteSelectedConfirm,
    deleteSelectedSponsors: deleteSelectedSponsors
  };
})();
