/* app.js — DOM wiring and rendering for the hosted site. Globals: CarShowConfig,
 * CarShowLogic, Papa, ExcelJS (ExcelJS/Papa are only exercised here via the
 * Developer > Run Regression Tests round-trip, see runRegressionTests()). */
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
    statusFilter: { paid: true, notpaid: false, cancelled: false, empty: false },
    inCarShowFilter: false, // Registration tab toolbar's "In Car Show" checkbox — when checked, only rows with In Car Show? = Yes are shown
    tab: "sum",
    detailRow: null,  // registration row currently shown in the detail modal, or null
    zoom: 1,          // table zoom level (1 = 100%); lets all columns fit without scrolling
    sponsorZoom: 1,   // sponsor table zoom level
    payments: [],     // sponsor payment records
    menuOpen: false,      // hamburger dropdown
    settingsOpen: false,  // settings modal
    testResults: null,    // { results: [{label, ok, expected, actual}], passed, failed } | null
    testRunning: false,
    testOnlyErrors: false,
    sponsors: [],          // filled by ingestSponsors(), called by index.php's boot script
    sponsorSearch: "",
    sponsorTypeFilter: { premier: true, corporate: true, individual: true },
    sponsorEditing: null,  // sponsor record being added/edited in the form modal, or null
    sponsorPaymentOpen: false, // sponsor payment recording modal
    sponsorPaymentError: null, // error message in payment modal
    sponsorSyncError: null, // set when a push to the server fails; shown in the Sponsors tab
    clearSponsorsOpen: false, // "Remove All Sponsors" confirmation modal
    sponsorSelected: {},    // id -> true, for the Sponsors tab's row checkboxes
    deleteSelectedOpen: false, // "Delete selected sponsors" confirmation modal
    developerOpen: false,      // hamburger's "Developer" password prompt expanded
    developerUnlocked: false,  // password verified this page load — reveals Import Members/Registrations
    developerError: null,      // developer password error message, or null
    changelogOpen: false,      // "Change Log" full page (Developer submenu)
    changelogLoading: false,
    changelogError: null,
    changelogMeta: null,       // { repo, ftp, files, filesDeployed, loc, totalChanges } once loaded
    changelogCommits: null,    // [{ sha, date, time, subject, body, version }] once loaded
    walkins: [],           // manually-added Walk-In Member/Nonmember registrations — filled by
                            // ingestWalkins(), called by index.php's boot script; server-synced
                            // the same way state.sponsors is, independent of the loaded CSVs
    walkinSyncError: null, // set when a push to the server fails; shown in the Add Registration modal
    addRegOpen: false,      // "+ Add Registration" form modal (Registration tab)
    members: [],            // ETCC member roster ({name, lastName, firstName, memberNumber,
                             // phone, email, address, city, state, zip}, whichever the last
                             // import's CSV had columns for) — filled by ingestMembers(); used by
                             // the Add Registration form to fill the whole form by looking up a
                             // Walk-In Member's name (see members-import.php)
    appSettings: {          // filled by ingestAppSettings(); see app-settings.php. Defaults here
                             // are just a fallback for the brief window before that hook runs —
                             // app-settings.php's own $defaults is the real source of truth.
      walkinFirstNonMember: 2000,
      walkInCarShowFee: 50,
      walkInNonCarShowFee: 0,
      preregistrationFee: 40,
      externalApiKey: "",
      windowCardPdf: "",
      tshirtVendorEmail: ""
    },
    appSettingsSaving: false,
    appSettingsError: null,   // set when a Settings save fails; shown in the Settings modal
    appSettingsSaved: false,  // brief "Saved" confirmation after a successful save
    apiPageOpen: false,       // Developer > API full-page screen
    apiKeyRevealed: false,
    apiTesting: false,
    apiTestResult: null,      // { status, ok, bodyText } | null
    apiRotating: false,
    apiRotateError: null,
    windowCardUploading: false,
    windowCardError: null,
    windowCardPdfVersion: 0, // bumped on every successful upload, for cache-busting the fetch() that fills it
    emailSubject: "",         // editable; defaulted when T-Shirts tab is opened
    emailBody: "",            // editable; defaulted when T-Shirts tab is opened
    emailCc: "",              // editable CC recipients
    emailBcc: "",             // editable BCC recipients
    emailSending: false,
    emailSendError: null,
    emailSent: false,         // brief "Sent!" confirmation after a successful send
    deletedCsvKeys: {},       // csvRegKey(rec) -> true, for CSV-derived rows removed via the
                               // Registration tab's checkbox/bulk-delete — filled by
                               // ingestDeletedRegistrations(); excluded from state.result.registrations
                               // in regenerate(), so they stay gone across reloads/re-imports too
    regSelected: {},           // rowKey(r) -> true, for the Registration tab's row checkboxes
    deleteRegSelectedOpen: false, // "Delete selected registrations" confirmation modal
    regDeleteSyncError: null,  // set when persisting a CSV-row deletion fails
    csvOverrides: {},          // csvRegKey(rec) -> patch object, for CSV-derived rows edited via
                                // the detail modal's Edit mode — filled by
                                // ingestRegistrationOverrides(); applied on top of
                                // state.result.registrations in regenerate(), so edits survive
                                // reloads/re-imports too (see registration-overrides.php)
    detailEditError: null      // set when saving a detail-modal edit fails
  };

  // Populated in init() below from window.__carshowSite, which
  // deploy/index.php injects as { sponsorsApiUrl: "...", walkinsApiUrl: "..." }
  // in the very first inline script, before app.js runs. Read inside init()
  // rather than at module-load time, since init() is what's guaranteed to run
  // after every inline script in the document, including this one. The Sponsors tab is
  // server-authoritative: state.sponsors is fetched fresh (via
  // ingestSponsors(), called by index.php's boot script), and every
  // add/edit/delete is pushed straight to sponsorsApiUrl — so every officer
  // viewing the site sees the same live list.
  var SITE_CONFIG = {};

  var NUMERIC_BASE = { "Reg #": 1, "Total Fee": 1, "Individual Sponsorship": 1, "Year": 1, "#": 1 };
  // These headers are far wider than their data (a few digits, "Yes"/"No") —
  // force-wrapping them onto two lines shrinks the column to fit the data
  // instead of the label, narrowing the overall row width.
  var NARROW_HEADER_COLS = { "Individual Sponsorship": 1, "In Car Show?": 1 };
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

  function debounce(fn, delay) {
    var timeoutId = null;
    return function () {
      var args = arguments;
      var context = this;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(function () { fn.apply(context, args); }, delay);
    };
  }

  // generatedAt defaults to "now", but callers with a real known ingestion
  // time — index.php's boot script, replaying the CSVs it stored on this
  // page load — should pass it explicitly so "CSVs loaded:" reflects when
  // the export actually happened, not whenever a visitor opens the page.
  function regenerate(generatedAt) {
    if (!state.reg) { state.result = null; renderViews(); return; }
    state.result = LOGIC.generate(state.reg.rows, state.act ? state.act.rows : [], {
      regFileName: state.reg.name,
      actFileName: state.act ? state.act.name : "",
      generatedAt: generatedAt || new Date()
    });
    // Exclude rows removed via the Registration tab's checkbox/bulk-delete,
    // then re-apply any detail-modal field edits, then backfill Spouse First
    // Name from the member roster — generate() has no notion of any of the
    // three, so all run against its fresh output every time. Order matters:
    // all three must run before syncSponsorsFromRegistrations() so a
    // deleted/edited/backfilled row's Individual Sponsorship (Text) is
    // reflected in the sync.
    if (state.result.ok) {
      state.result.registrations = state.result.registrations
        .filter(function (r) { return !state.deletedCsvKeys[csvRegKey(r)]; })
        .map(function (r) {
          var patch = state.csvOverrides[csvRegKey(r)];
          return patch ? applyRecordPatch(r, patch) : r;
        })
        .map(fillSpouseFirstNameFromRoster);
    }
    state.sortCol = null; state.sortDir = 1;
    syncSponsorsFromRegistrations();
    syncPaidRegistrationsCache();
    renderViews();
  }

  // Any registrant with a nonzero Individual Sponsorship fee becomes a real
  // row in the Sponsors tab (type "individual"), so they're counted in the
  // Summary tab's Individual Sponsors card instead of a separate raw-CSV
  // figure. Insert-only, matched by a stable id — reloading the same CSVs
  // never creates duplicates, and never overwrites a sponsor an officer has
  // since edited by hand (e.g. added a website).
  //
  // The id is derived from Reg Date + name, NOT Reg #: non-member
  // registrants get a Reg # auto-assigned fresh by generate() on
  // every load (see regenerate() -> LOGIC.generate()), and that assignment
  // depends on row order, so the same numeric value could mean a different
  // person on a re-export. Reg Date (the registration transaction's own
  // timestamp) plus name is stable for the same person's same registration
  // across exports, and distinct across different people.
  // Stable identity for a CSV-derived registration row across re-exports —
  // shared by csvSponsorId() below (prefixed, its own namespace) and the
  // Registration tab's checkbox-delete and detail-modal-edit features
  // (unprefixed, used directly as a key into state.deletedCsvKeys/
  // state.csvOverrides — see rowKey()).
  function csvRegKey(rec) {
    var raw = String(rec["Reg Date"] || "") + "_" + String(rec["Last Name"] || "") + "_" + String(rec["First Name"] || "");
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function csvSponsorId(rec) { return "csvind_" + csvRegKey(rec); }

  // Merges an edit patch onto a copy of a record, recomputing Gen if Year was
  // part of the patch (Gen is derived, never directly editable — see
  // EDITABLE_FIELDS/renderDetailModal), and re-applying the Individual
  // Sponsorship Text default in case the edit is what pushed Individual
  // Sponsorship above 0 (see applySponsorshipTextDefault — a no-op if Text is
  // already set, whether that's from a prior default or an officer's own
  // edit). Shared by regenerate() (re-applying a persisted CSV-row edit every
  // load) and the detail modal's Save handler (building the just-edited
  // record to show immediately, before the next reload).
  function applyRecordPatch(rec, patch) {
    var merged = {};
    Object.keys(rec).forEach(function (k) { merged[k] = rec[k]; });
    Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
    if (Object.prototype.hasOwnProperty.call(patch, "Year")) {
      merged["Gen"] = LOGIC.genFromYear(LOGIC.toInt(patch["Year"]));
    }
    LOGIC.applySponsorshipTextDefault(merged);
    return merged;
  }

  // Backfills Spouse First Name from the member roster (members-data.json,
  // via Developer > Import Members) for a CSV-imported registration whose
  // own Reg # (the registrant's real ETCC member number) matches a
  // roster entry with a spouseFirstName on file — see members-import.php's
  // comment. Insert-only, same as applySponsorshipTextDefault: never
  // overwrites an officer's own detail-modal edit. Non-members (an
  // auto-assigned placeholder Reg #) never match any roster entry,
  // which is correct — there's no roster record to backfill from. Skips the
  // fill (leaves it blank) if the roster's spouseFirstName is the same as
  // the registrant's own First Name (case-insensitive) — some roster rows
  // for a single member carry their own name in that column rather than
  // leaving it blank, which would otherwise read as a self-referential
  // "spouse". Routed through applyRecordPatch so Individual Sponsorship
  // Text's own default recomputes too, in case a spouse name showing up is
  // what makes "First and Spouse Last" possible for a sponsor whose text is
  // still blank.
  function fillSpouseFirstNameFromRoster(rec) {
    if (rec["Spouse First Name"]) return rec;
    var num = Number(rec["Reg #"]);
    if (!num) return rec;
    var match = state.members.filter(function (m) { return Number(m.memberNumber) === num; })[0];
    if (!match || !match.spouseFirstName) return rec;
    var spouse = String(match.spouseFirstName).trim();
    var own = String(rec["First Name"] || "").trim();
    if (spouse.toLowerCase() === own.toLowerCase()) return rec;
    return applyRecordPatch(rec, { "Spouse First Name": spouse });
  }

  function syncSponsorsFromRegistrations() {
    if (!state.result || !state.result.ok) return;
    var byId = {};
    state.sponsors.forEach(function (s) { byId[s.id] = s; });
    state.result.registrations.forEach(function (rec) {
      var fee = rec["Individual Sponsorship"];
      if (fee === "" || fee == null || Number(fee) <= 0) return;
      var id = csvSponsorId(rec);
      var existing = byId[id];
      if (existing) {
        // Backfill Reg Date / Ind. Spon. Text on sponsors synced before those
        // columns existed. Reg Date is safe to patch unconditionally — it's
        // derived, system-set data nobody hand-edits. Ind. Spon. Text is only
        // backfilled the one time it's missing; afterward it's insert-only
        // like every other copied field (phone, email, Member, ...), so an
        // officer's own edit to a sponsor's displayed acknowledgment text
        // survives future re-syncs.
        var patch = {};
        if (!existing.regDate && rec["Reg Date"]) patch.regDate = rec["Reg Date"];
        if (!existing.individualSponsorshipText && rec["Ind. Spon. Text"]) patch.individualSponsorshipText = rec["Ind. Spon. Text"];
        if (Object.keys(patch).length) {
          var patched = {};
          Object.keys(existing).forEach(function (k) { patched[k] = existing[k]; });
          Object.keys(patch).forEach(function (k) { patched[k] = patch[k]; });
          byId[id] = patched;
          upsertSponsor(patched);
        }
        return;
      }
      var cityStateZip = [rec["City"], rec["State"]].filter(Boolean).join(", ") + (rec["Zip"] ? " " + rec["Zip"] : "");
      var sponsorName = (rec["Last Name"] || "") + (rec["First Name"] ? ", " + rec["First Name"] : "");
      var isMember = Number(rec["Reg #"]) < CONFIG.firstNonMember;
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
        shirtSize: rec._sponsorShirtSize || "",
        individualSponsorshipText: rec["Ind. Spon. Text"] || ""
      });
    });
  }

  // ---------- views ----------
  function renderViews() {
    var app = $("#app");
    app.innerHTML = "";
    app.appendChild(buildTabs());

    // Sponsors are manually entered and independent of the loaded CSVs, so
    // this tab works even before a registration CSV pair has been imported.
    if (state.tab === "sponsors") {
      app.appendChild(buildSponsorsToolbar());
      app.appendChild(buildSponsorsView());
      return;
    }

    // T-Shirts tab shows email composer and report; also works without CSV data.
    if (state.tab === "tsh") {
      app.appendChild(buildTshirtView());
      return;
    }

    if (!state.result) {
      app.appendChild(el("div", { class: "empty-state" },
        ["No registration data loaded yet — use the menu's Developer → Import Registrations to load the first CSV export."]));
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
    if (state.tab === "reg" && state.regDeleteSyncError) {
      app.appendChild(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.regDeleteSyncError]));
    }
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
    return el("div", { class: "tabs no-print" }, [mk("sum", "Summary"), mk("reg", "Registration"), mk("sponsors", "Sponsors"), mk("tsh", "T-Shirts")]);
  }

  // CSVs are (re)ingested synchronously right before regenerate() runs, so
  // meta.generatedAt doubles as "when the currently-loaded CSVs were loaded".
  function buildLoadedInfo() {
    return el("div", { class: "loadedinfo" }, ["CSVs loaded: " + fmtDate(state.result.meta.generatedAt)]);
  }

  function buildRegToolbar() {
    var search = el("input", { type: "search", placeholder: "Search name, club, email…", value: state.search });
    search.addEventListener("input", function () { state.search = search.value; renderRegBody(); });

    var inCarShowCb = el("input", { type: "checkbox" }); inCarShowCb.checked = state.inCarShowFilter;
    inCarShowCb.addEventListener("change", function () { state.inCarShowFilter = inCarShowCb.checked; renderRegBody(); });
    var statusGroup = el("span", { class: "statusgroup" }, [
      el("span", { class: "hint" }, ["Status:"])
    ].concat(STATUS_BUCKETS.map(function (b) {
      var cb = el("input", { type: "checkbox" }); cb.checked = state.statusFilter[b.key];
      cb.addEventListener("change", function () { state.statusFilter[b.key] = cb.checked; renderRegBody(); });
      return el("label", {}, [cb, document.createTextNode(" " + b.label)]);
    })).concat([el("label", {}, [inCarShowCb, document.createTextNode(" In Car Show")])]));

    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", printRegistration);

    var delBtn = el("button", { class: "btn", id: "regDeleteBtn", disabled: "disabled" }, ["🗑 Delete"]);
    delBtn.addEventListener("click", openDeleteRegSelectedConfirm);

    var printCardsBtn = el("button", { class: "btn", id: "regPrintCardsBtn", disabled: "disabled" }, ["🪟 Print Window Cards"]);
    printCardsBtn.addEventListener("click", printSelectedWindowCards);

    var addBtn = el("button", { class: "btn primary" }, ["+ Add Registration"]);
    addBtn.addEventListener("click", openAddRegistration);

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
      statusGroup,
      count,
      el("span", { class: "spacer" }),
      zoomGroup
    ];
    kids.push(prn, printCardsBtn, delBtn, addBtn);
    return el("div", { class: "toolbar no-print" }, kids);
  }
  function buildSummaryToolbar() {
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", function () { clearPrintHost(); window.print(); });
    return el("div", { class: "toolbar no-print" }, [el("span", { class: "spacer" }), prn]);
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
      return el("tr", {}, cells);
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

    var selectAllCb = el("input", { type: "checkbox", id: "regSelectAll", title: "Select all" });
    selectAllCb.addEventListener("change", function () { toggleSelectAllReg(selectAllCb.checked); });
    htr.appendChild(el("th", { class: "no-print" + pinnedClass(0) }, [selectAllCb]));

    cols.forEach(function (c, idx) {
      var label = c === SHIRTS_COL ? "Shirts" : c;
      // Non-breaking space so this short header never wraps between "Reg"
      // and "#" even at a narrow column width (table.grid thead th uses
      // white-space: normal so longer headers like "Spouse First Name" can
      // wrap onto two lines) — c itself (used for sort/lookup) is untouched.
      if (label === "Reg #") label = "Reg #";
      var arrow = state.sortCol === c ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
      var th = el("th", { class: (c === SHIRTS_COL ? "shirtsum" : (isNumericCol(c) ? "num" : "")) +
          (NARROW_HEADER_COLS[c] ? " narrow-hdr" : "") + pinnedClass(idx + 1) },
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

  // ---------- pinned columns (checkbox + Reg Type + Last Name + First Name stay visible while scrolling) ----------
  // Each pinned cell is `position: sticky`; every one after the first needs
  // its `left` set to the summed rendered width of the pinned cells before
  // it, or they'd all sit at left:0 and overlap/mangle each other.
  var PINNED_COUNT = 5; // checkbox, Reg #, Reg Type, Last Name, First Name
  function pinnedClass(idx) {
    return idx < PINNED_COUNT ? " pinned pin-" + (idx + 1) : "";
  }
  function updatePinnedOffsets() {
    var table = $(".tablewrap table.grid");
    var headRow = table && table.querySelector("thead tr");
    if (!headRow) return;
    // getBoundingClientRect is in post-zoom (visual) px; the `zoom` CSS property
    // re-scales inline-style lengths too, so divide back out or the offset
    // would be applied twice.
    var offset = 0;
    for (var i = 0; i < PINNED_COUNT; i++) {
      var cell = headRow.children[i];
      if (!cell) break;
      var cells = table.querySelectorAll(".pin-" + (i + 1));
      for (var j = 0; j < cells.length; j++) cells[j].style.left = offset + "px";
      offset += cell.getBoundingClientRect().width / state.zoom;
    }
  }

  // ---------- zoom (shrink the table so all columns fit without horizontal scrolling) ----------
  function setZoom(z) {
    state.zoom = Math.max(0.3, Math.min(1.5, z));
    renderViews();
  }
  function setSponsorZoom(z) {
    state.sponsorZoom = Math.max(0.3, Math.min(1.5, z));
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
  function fitSponsorZoom() {
    var wrap = $(".tablewrap");
    var table = wrap && wrap.querySelector("table.grid");
    if (!wrap || !table) return;
    var availableWidth = wrap.parentElement.clientWidth;
    var priorZoom = wrap.style.zoom;
    wrap.style.zoom = "1";
    var naturalWidth = table.scrollWidth;
    wrap.style.zoom = priorZoom;
    if (!naturalWidth) return;
    setSponsorZoom(availableWidth / naturalWidth);
  }

  // CSV-derived registrations plus manually-added Walk-In Member/Nonmember
  // rows — the single merge point everything downstream (table body, search,
  // sort, print, detail modal Prev/Next, live Summary tab) reads through, so
  // walk-ins behave identically to a CSV row everywhere except persistence.
  function allRegistrations() {
    return (state.result ? state.result.registrations : []).concat(state.walkins);
  }

  // Keeps the external Paid Registrations API's server-side cache in sync
  // with whatever this browser currently shows. There's no PHP port of
  // logic.js's generate() pipeline (see regenerate() above) — rather than
  // duplicate that whole thing server-side, this pushes a filtered snapshot
  // to paid-registrations-cache.php every time something registration-status-
  // related changes (CSV import, a Status edit, a Walk-In add/edit/delete, a
  // bulk delete). Fire-and-forget, same as the other *ToServer pushes below —
  // the external API just serves a slightly stale snapshot until the next
  // successful sync if this fails. See deploy/paid-registrations-cache.php
  // and deploy/paid-registrations-api.php.
  function syncPaidRegistrationsCache() {
    if (!SITE_CONFIG.paidRegistrationsCacheApiUrl) return;
    var registrations = allRegistrations()
      .filter(function (r) { return classifyStatus(r["Status"]) === "paid"; })
      .map(function (r) {
        // Source field renamed to "Reg #" internally — the external
        // API's own JSON field name (memberNumber) is a stable public
        // contract and stays as-is regardless of this internal rename.
        var mn = r["Reg #"];
        return {
          memberNumber: mn === "" || mn == null ? null : Number(mn),
          firstName: r["First Name"] || "",
          lastName: r["Last Name"] || "",
          phone: r["Phone"] || "",
          email: r["Email"] || ""
        };
      });
    fetch(SITE_CONFIG.paidRegistrationsCacheApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", registrations: registrations })
    }).catch(function () { /* best-effort — see comment above */ });
  }

  // Stable selection/deletion key for any registration row — a walk-in's own
  // .id if it has one, otherwise its csvRegKey(). Used by the Registration
  // tab's row checkboxes and by deleteSelectedReg() to route each selected
  // row to the right deletion mechanism (see below).
  function rowKey(r) { return r.id || csvRegKey(r); }

  // ---------- Registration tab row selection + bulk delete ----------
  function selectedRegKeys() { return Object.keys(state.regSelected); }
  function setRegSelected(key, checked) {
    if (checked) state.regSelected[key] = true; else delete state.regSelected[key];
  }
  function toggleSelectAllReg(checked) {
    visibleRows().forEach(function (r) { setRegSelected(rowKey(r), checked); });
    renderRegBody();
  }
  function openDeleteRegSelectedConfirm() {
    if (!selectedRegKeys().length) return;
    state.deleteRegSelectedOpen = true;
    renderDeleteRegSelectedConfirm();
  }
  function closeDeleteRegSelectedConfirm() { state.deleteRegSelectedOpen = false; renderDeleteRegSelectedConfirm(); }
  // Walk-In rows are deleted immediately via removeWalkin(). CSV-derived rows
  // have no per-row server record to delete — instead their csvRegKey() is
  // added to state.deletedCsvKeys and persisted to deleted-registrations.json,
  // and regenerate() excludes any matching key from every future CSV parse
  // (including a fresh re-import that still contains the same row) — see
  // that function's comment.
  function deleteSelectedReg() {
    var rows = allRegistrations();
    var byKey = {};
    rows.forEach(function (r) { byKey[rowKey(r)] = r; });
    var csvKeysDeleted = [];
    selectedRegKeys().forEach(function (key) {
      var r = byKey[key];
      if (!r) return;
      if (r.id) {
        removeWalkin(r.id);
      } else {
        state.deletedCsvKeys[key] = true;
        csvKeysDeleted.push(key);
      }
    });
    if (csvKeysDeleted.length && state.result && state.result.ok) {
      state.result.registrations = state.result.registrations.filter(function (r) {
        return !state.deletedCsvKeys[csvRegKey(r)];
      });
      pushDeletedRegistrationsToServer(csvKeysDeleted);
    }
    state.regSelected = {};
    syncPaidRegistrationsCache();
    renderViews();
  }
  function pushDeletedRegistrationsToServer(keys) {
    if (!SITE_CONFIG.deletedRegistrationsApiUrl) return;
    fetch(SITE_CONFIG.deletedRegistrationsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", keys: keys })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.regDeleteSyncError = null;
    }).catch(function () {
      state.regDeleteSyncError = "Could not save that deletion to the server — it'll reappear if the page is reloaded before this succeeds. Check your connection and try again.";
      renderViews();
    });
  }
  // Persists a CSV row's detail-modal edit. Fire-and-forget like the deletion
  // push above — the local state.csvOverrides/table already reflect the edit
  // immediately; a failure here just means it could revert on the next reload
  // if not retried.
  function pushRegistrationOverrideToServer(key, patch) {
    if (!SITE_CONFIG.registrationOverridesApiUrl) return;
    fetch(SITE_CONFIG.registrationOverridesApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", key: key, patch: patch })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.detailEditError = null;
    }).catch(function () {
      state.detailEditError = "Could not save that edit to the server — it'll revert if the page is reloaded before this succeeds. Check your connection and try again.";
      renderViews();
    });
  }
  function renderDeleteRegSelectedConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.deleteRegSelectedOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeleteRegSelectedConfirm);
    var count = selectedRegKeys().length;
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Delete " + count + " Registration" + (count === 1 ? "" : "s") + "?" }), el("span", { class: "spacer" }), closeBtn]);

    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" }, ["Yes, Delete"]);
    yesBtn.addEventListener("click", function () { closeDeleteRegSelectedConfirm(); deleteSelectedReg(); });
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeDeleteRegSelectedConfirm);

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This permanently removes the " + count + " selected registration" + (count === 1 ? "" : "s") +
        ". Walk-In rows are deleted outright; CSV-imported rows are excluded going forward — including from a " +
        "later CSV re-import that still contains the same row. This cannot be undone from the app."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ]);

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDeleteRegSelectedConfirm);
    host.appendChild(backdrop);
  }

  // The next unassigned Walk-In Nonmember number — a pool deliberately
  // separate from the CSV import's own nonmember auto-numbering (which stays
  // hardcoded at CONFIG.firstNonMember/8001; see generate() in logic.js).
  // Starts from the officer-configurable Developer > Settings value
  // (state.appSettings.walkinFirstNonMember, default 2000) and advances past
  // any Walk-In Nonmembers already added, so two added back to back never
  // collide with each other.
  function nextAvailableWalkinNumber() {
    var next = Number(state.appSettings.walkinFirstNonMember) || 2000;
    state.walkins.forEach(function (w) {
      var n = Number(w["Reg #"]);
      if (n >= next) next = n + 1;
    });
    return next;
  }

  function sortedRows() {
    var rows = allRegistrations();
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
  // the same sort/search state the user has the table set to.
  function visibleRows() {
    var cols = visibleColumns();
    var q = state.search.trim().toLowerCase();
    return sortedRows().filter(function (r) {
      if (!state.statusFilter[classifyStatus(r["Status"])]) return false;
      if (state.inCarShowFilter && String(r["In Car Show?"]).trim().toLowerCase() !== "yes") return false;
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
      var key = rowKey(r);
      var tr = el("tr");
      tr.title = "Click for full details";
      tr.addEventListener("click", function () { openDetail(r); });

      var cb = el("input", { type: "checkbox" });
      cb.checked = !!state.regSelected[key];
      cb.addEventListener("click", function (e) { e.stopPropagation(); });
      cb.addEventListener("change", function () { setRegSelected(key, cb.checked); renderRegBody(); });
      tr.appendChild(el("td", { class: "no-print" + pinnedClass(0) }, [cb]));

      cols.forEach(function (c, idx) {
        var v, cls = "";
        if (c === SHIRTS_COL) { cls = "shirtsum"; v = shirtSummaryText(r); }
        else if (CURRENCY_COLS[c]) { cls = "num"; v = fmtMoney(r[c]); }
        else if (isNumericCol(c)) { cls = "num"; v = r[c]; v = v == null ? "" : v; }
        else { v = r[c]; }
        cls += pinnedClass(idx + 1);
        tr.appendChild(el("td", { class: cls.trim(), text: v == null ? "" : String(v) }));
      });
      frag.appendChild(tr);
    });
    body.innerHTML = "";
    body.appendChild(frag);
    updatePinnedOffsets();
    var rc = $("#rowcount");
    if (rc) rc.textContent = rows.length + " of " + allRegistrations().length + " rows shown";
    var selectAllCb = $("#regSelectAll");
    if (selectAllCb) {
      var visibleKeys = rows.map(rowKey);
      var selectedVisible = visibleKeys.filter(function (k) { return state.regSelected[k]; });
      selectAllCb.checked = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;
      selectAllCb.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleKeys.length;
    }
    var delBtn = $("#regDeleteBtn");
    if (delBtn) {
      var n = selectedRegKeys().length;
      delBtn.textContent = "🗑 Delete" + (n ? " (" + n + ")" : "");
      if (n) delBtn.removeAttribute("disabled"); else delBtn.setAttribute("disabled", "disabled");
    }
    var printCardsBtn = $("#regPrintCardsBtn");
    if (printCardsBtn) {
      var byKey = {};
      allRegistrations().forEach(function (r) { byKey[rowKey(r)] = r; });
      var printable = selectedRegKeys().filter(function (key) {
        var r = byKey[key];
        return r && String(r["In Car Show?"]).trim().toLowerCase() === "yes";
      }).length;
      printCardsBtn.textContent = "🪟 Print Window Cards" + (printable ? " (" + printable + ")" : "");
      if (printable) printCardsBtn.removeAttribute("disabled"); else printCardsBtn.setAttribute("disabled", "disabled");
    }
  }

  // ---------- detail modal ----------
  // Click any row to see every field for that one registration without scrolling —
  // grouped into readable sections instead of the table's 40+ side-by-side columns.
  var DETAIL_SECTIONS = [
    { title: "Registration", cols: ["Reg Date", "Reg Type", "Status", "Total Fee", "Individual Sponsorship", "Spouse First Name", "#"] },
    { title: "Contact", cols: ["Phone", "Email", "Address", "City", "State", "Zip"] },
    { title: "Vehicle", cols: ["Year", "Model", "Color", "Gen", "In Car Show?"] }
  ];
  // Reg Date, Reg Type, and Gen are deliberately excluded — system/derived
  // values, never hand-edited. Gen recomputes automatically if Year changes
  // (see applyRecordPatch). Shirts (a separate section below, not part of
  // DETAIL_SECTIONS) stay read-only too — a 24-bucket editor is a separate,
  // bigger task than these plain text/select fields. Spouse First Name has
  // no CSV source at all (see config.js) — editing here is the only way to
  // set it. Ind. Spon. Text isn't shown/editable here anymore (removed from
  // the Registration tab/detail modal) — it's still computed on every record
  // (see applySponsorshipTextDefault in logic.js) and feeds the Sponsors
  // tab's own Ind. Spon. Text column at sync time, just not a
  // baseColumnOrder column here.
  var EDITABLE_FIELDS = {
    "Reg #": 1, "Last Name": 1, "First Name": 1, "Club Name": 1, "Status": 1, "Total Fee": 1, "Individual Sponsorship": 1,
    "Spouse First Name": 1, "#": 1,
    "Phone": 1, "Email": 1, "Address": 1, "City": 1, "State": 1, "Zip": 1,
    "Year": 1, "Model": 1, "Color": 1, "Gen": 1, "In Car Show?": 1
  };
  var INT_EDIT_FIELDS = { "Reg #": 1, "#": 1, "Year": 1 };
  var NUM_EDIT_FIELDS = { "Total Fee": 1, "Individual Sponsorship": 1 };

  function openDetail(row) { state.detailRow = row; state.detailEditError = null; renderDetailModal(); }
  function closeDetail() { state.detailRow = null; state.detailEditError = null; renderDetailModal(); }
  function stepDetail(dir) {
    var list = visibleRows(), i = list.indexOf(state.detailRow);
    if (i === -1) return;
    var next = list[i + dir];
    if (next) { state.detailRow = next; state.detailEditError = null; renderDetailModal(); }
  }

  // Builds one <li> for column c — always editable for EDITABLE_FIELDS,
  // read-only otherwise. Registers editable inputs on fieldEls so
  // saveDetailEdit() can read every field back out at Save time.
  function detailFieldItem(r, c, fieldEls) {
    if (EDITABLE_FIELDS[c]) {
      var input;
      if (c === "In Car Show?") {
        input = el("select", {});
        ["No", "Yes"].forEach(function (v) {
          var o = el("option", { value: v, text: v });
          if (String(r[c]) === v) o.setAttribute("selected", "selected");
          input.appendChild(o);
        });
      } else if (c === "Status") {
        var current = r[c] == null ? "" : String(r[c]);
        var opts = ["Paid", "Not Paid", "Cancelled"];
        if (current && opts.indexOf(current) === -1) opts.unshift(current);
        input = el("select", {});
        opts.forEach(function (v) {
          var o = el("option", { value: v, text: v });
          if (v === current) o.setAttribute("selected", "selected");
          input.appendChild(o);
        });
      } else {
        input = el("input", { type: "text", value: r[c] == null ? "" : String(r[c]) });
      }
      fieldEls[c] = input;
      return li(c, "", input);
    }
    var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : r[c];
    return li(c, v == null || v === "" ? "—" : String(v));
  }

  function saveDetailEdit(fieldEls) {
    var r = state.detailRow;
    if (!r) return;
    var patch = {};
    Object.keys(EDITABLE_FIELDS).forEach(function (c) {
      var input = fieldEls[c];
      if (!input) return;
      var raw = input.value;
      if (INT_EDIT_FIELDS[c]) patch[c] = LOGIC.toInt(raw);
      else if (NUM_EDIT_FIELDS[c]) patch[c] = LOGIC.toNum(raw);
      else patch[c] = raw.trim();
    });

    var merged;
    if (r.id) {
      // Walk-In row — already has a full server record; merge and push it directly.
      merged = applyRecordPatch(r, patch);
      upsertWalkin(merged);
    } else {
      // CSV-derived row — no per-row server record of its own, so persist just
      // the patch, keyed by the row's stable identity (see csvRegKey/regenerate()).
      var key = csvRegKey(r);
      state.csvOverrides[key] = patch;
      pushRegistrationOverrideToServer(key, patch);
      merged = applyRecordPatch(r, patch);
      if (state.result && state.result.ok) {
        state.result.registrations = state.result.registrations.map(function (row) {
          return csvRegKey(row) === key ? merged : row;
        });
      }
    }
    state.detailRow = merged;
    syncPaidRegistrationsCache();
    renderDetailModal();
    if (state.tab === "reg") renderRegBody();
  }

  function deleteDetailRow() {
    var r = state.detailRow;
    if (!r) return;
    if (r.id) {
      removeWalkin(r.id);
    } else {
      var key = csvRegKey(r);
      state.deletedCsvKeys[key] = true;
      pushDeletedRegistrationsToServer([key]);
      if (state.result && state.result.ok) {
        state.result.registrations = state.result.registrations.filter(function (row) {
          return !state.deletedCsvKeys[csvRegKey(row)];
        });
      }
    }
    closeDetail();
    syncPaidRegistrationsCache();
    renderViews();
  }

  function renderDetailModal() {
    var host = $("#detailHost");
    if (!host) return;
    host.innerHTML = "";
    var r = state.detailRow;
    if (!r) return;
    var list = visibleRows(), i = list.indexOf(r);
    var fieldEls = {};

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDetail);
    var prevBtn = el("button", { class: "btn" }, ["‹ Prev"]);
    if (i <= 0) prevBtn.setAttribute("disabled", "disabled");
    prevBtn.addEventListener("click", function () { stepDetail(-1); });
    var nextBtn = el("button", { class: "btn" }, ["Next ›"]);
    if (i === -1 || i >= list.length - 1) nextBtn.setAttribute("disabled", "disabled");
    nextBtn.addEventListener("click", function () { stepDetail(1); });
    var printCardBtn = el("button", { class: "btn" }, ["🪟 Print Window Card"]);
    printCardBtn.addEventListener("click", function () { printWindowCard(r); });

    var name = (r["Last Name"] || "") + (r["First Name"] ? ", " + r["First Name"] : "");
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: name || "Registration" }),
      el("span", { class: "count", text: i > -1 ? (i + 1) + " of " + list.length : "" }),
      prevBtn, nextBtn, printCardBtn, closeBtn
    ]);

    var body = el("div", { class: "modal-body" }, [
      el("ul", { class: "meta-list" }, [
        detailFieldItem(r, "Reg #", fieldEls),
        detailFieldItem(r, "Club Name", fieldEls)
      ])
    ]);
    DETAIL_SECTIONS.forEach(function (sec) {
      var cols = sec.cols.filter(function (c) { return state.result.columns.indexOf(c) !== -1; });
      var items = cols.map(function (c) { return detailFieldItem(r, c, fieldEls); });
      if (items.length) body.appendChild(el("div", { class: "modal-section" }, [el("h4", { text: sec.title }), el("ul", { class: "meta-list" }, items)]));
    });

    var parts = shirtSummaryParts(r);
    var shirtItems = parts.length ? parts.map(function (p) { return li(p.label, String(p.qty)); })
      : [el("li", { class: "hint", text: "No shirts on this registration." })];
    body.appendChild(el("div", { class: "modal-section" }, [el("h4", { text: "Shirts" }), el("ul", { class: "meta-list" }, shirtItems)]));

    var autoSaveDetail = debounce(function () { saveDetailEdit(fieldEls); }, 1500);
    Object.keys(fieldEls).forEach(function (key) {
      fieldEls[key].addEventListener("input", autoSaveDetail);
      fieldEls[key].addEventListener("change", autoSaveDetail);
    });

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () { saveDetailEdit(fieldEls); });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closeDetail);
    var actions = [saveBtn, cancelBtn];
    if (r.id) {
      var delBtn = el("button", { class: "btn", style: "color:var(--warn)" }, ["Delete"]);
      delBtn.addEventListener("click", deleteDetailRow);
      actions.push(delBtn);
    }
    body.appendChild(el("div", { class: "settings-actions" }, actions));
    if (state.detailEditError) body.appendChild(el("div", { class: "form-error" }, [state.detailEditError]));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDetail);
    host.appendChild(backdrop);
  }

  // ---------- summary ----------
  // Recomputed from whatever the Registration tab's search/status filters
  // currently leave visible, rather than always the full loaded
  // dataset — so this tab always reflects "what I've selected over there".
  function buildSummaryView() {
    var s = LOGIC.summarizeRecords(visibleRows(), CONFIG);
    // Funds = registrations' own Total Fee (s.funds, includes each
    // registrant's own Individual Sponsorship add-on fee, since that's part
    // of their registration) + Premier/Corporate sponsor fees, which are
    // standalone businesses with no registration of their own to carry a
    // Total Fee. Individual sponsors are deliberately excluded here — their
    // $100 is already counted once via the registrant's own Total Fee, so
    // adding sponsorStatsByType("individual").total too would double it.
    var sponsorFunds = sponsorStatsByType("premier").total + sponsorStatsByType("corporate").total;
    var totalFunds = Number(s.funds) + sponsorFunds;
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
        li("Showing", s.registrations + " of " + allRegistrations().length + " registrations — matches the Registration tab's current search/status filters")
      ])
    ]));

    // totals cards
    container.appendChild(el("div", { class: "cards" }, [
      card("Registrations", s.registrations),
      card("Funds", "$" + totalFunds.toLocaleString(undefined, { minimumFractionDigits: 0 }))
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

  // Shirt totals for the T-Shirt Order Email (Developer > 📧 T-Shirt Order
  // Email) — same "registration shirts collapsed to gender, plus every
  // sponsor's own pick" combination as combinedShirtMatrix() above, but
  // scoped to only registrations whose Status classifies as "paid" (an
  // explicit choice — a shirt order shouldn't include people who never
  // completed payment), and returning plain data rather than a DOM table so
  // it can feed the email's plain-text body.
  function tshirtOrderShirtCounts() {
    var paidRows = allRegistrations().filter(function (r) { return classifyStatus(r["Status"]) === "paid"; });
    var totals = LOGIC.summarizeRecords(paidRows, CONFIG).shirtTotals;
    var sponsorCounts = allSponsorShirtCounts();
    return CONFIG.SIZES.map(function (sz) {
      var mens = 0, womens = 0;
      CONFIG.GROUPS.forEach(function (g) {
        var val = totals[g.key + sz.key] || 0;
        if (g.gender === "Men's") mens += val; else womens += val;
      });
      mens += sponsorCounts[sz.key].mens;
      womens += sponsorCounts[sz.key].womens;
      return { label: sz.label, mens: mens, womens: womens };
    });
  }
  function tshirtEmailSponsorList(typeKey) {
    return state.sponsors.filter(function (sp) { return sp.sponsorType === typeKey; });
  }
  // Plain text (not HTML) — carshow_send_mail() only sends text/plain, and a
  // plain-text preview is trivially exact: what's shown is byte-for-byte
  // what gets sent, with no separate HTML-rendering path to drift from it.
  function buildTshirtOrderEmailBody() {
    var lines = ["ETCC Car Show — T-Shirt Order", ""];
    function section(title, list, textFn) {
      lines.push(title);
      if (!list.length) {
        lines.push("  (none)");
      } else {
        list.forEach(function (item) { lines.push("  - " + textFn(item)); });
      }
      lines.push("");
    }
    section("PREMIER SPONSORS", tshirtEmailSponsorList("premier"), function (sp) {
      return sp.name + (sp.website ? " — " + sp.website : "");
    });
    section("CORPORATE SPONSORS", tshirtEmailSponsorList("corporate"), function (sp) {
      return sp.name + (sp.website ? " — " + sp.website : "");
    });
    section("INDIVIDUAL SPONSORS", tshirtEmailSponsorList("individual"), function (sp) {
      return sp.individualSponsorshipText || sp.name;
    });
    lines.push("SHIRT COUNTS (Paid registrations + all sponsors, by size)");
    tshirtOrderShirtCounts().forEach(function (c) {
      lines.push("  " + c.label + " — Men's: " + c.mens + ", Women's: " + c.womens);
    });
    return lines.join("\n");
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
    { key: "lastPaymentDate", label: "Payment Date" },
    { key: "lastPaymentType", label: "Type" },
    { key: "lastPaymentCheckNum", label: "Check #" },
    { key: "lastPaymentAmount", label: "Amount" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "website", label: "Website" },
    { key: "etccMemberName", label: "Member" },
    { key: "sponsorType", label: "Sponsor Type" },
    { key: "individualSponsorshipText", label: "Individual Sponsorship Text" },
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
  function getLastPaymentForSponsor(sponsorId) {
    var sponsorPayments = state.payments.filter(function (p) { return p.sponsorId === sponsorId; });
    if (!sponsorPayments.length) return null;
    sponsorPayments.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return sponsorPayments[0];
  }

  function sponsorFieldText(s, colKey) {
    if (colKey === "sponsorType") return sponsorTypeLabel(s.sponsorType);
    if (colKey === "lastPaymentDate") {
      var payment = getLastPaymentForSponsor(s.id);
      return payment ? fmtDate(payment.date) : "";
    }
    if (colKey === "lastPaymentType") {
      var payment = getLastPaymentForSponsor(s.id);
      return payment ? payment.paymentType : "";
    }
    if (colKey === "lastPaymentCheckNum") {
      var payment = getLastPaymentForSponsor(s.id);
      return payment ? (payment.checkNum || "—") : "";
    }
    if (colKey === "lastPaymentAmount") {
      var payment = getLastPaymentForSponsor(s.id);
      return payment ? fmtMoney(payment.amount) : "";
    }
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
  // Local state is updated optimistically; the write additionally
  // (asynchronously) goes to the server — every officer viewing the site
  // reads that same server copy on their next page load.
  function upsertSponsor(record) {
    var idx = -1;
    state.sponsors.forEach(function (s, i) { if (s.id === record.id) idx = i; });
    if (idx === -1) state.sponsors.push(record); else state.sponsors[idx] = record;
    pushSponsorToServer("upsert", { sponsor: record });
  }
  function removeSponsor(id) {
    state.sponsors = state.sponsors.filter(function (s) { return s.id !== id; });
    pushSponsorToServer("delete", { id: id });
  }

  // ---------- walk-in registrations (Registration tab's "+ Add Registration") ----------
  // Same optimistic-local-update-then-server-push pattern as sponsors above —
  // see upsertSponsor/pushSponsorToServer's comments.
  function upsertWalkin(record) {
    var idx = -1;
    state.walkins.forEach(function (w, i) { if (w.id === record.id) idx = i; });
    if (idx === -1) state.walkins.push(record); else state.walkins[idx] = record;
    pushWalkinToServer("upsert", { registration: record });
    syncPaidRegistrationsCache();
  }
  function removeWalkin(id) {
    state.walkins = state.walkins.filter(function (w) { return w.id !== id; });
    pushWalkinToServer("delete", { id: id });
    syncPaidRegistrationsCache();
  }
  function pushWalkinToServer(action, payload) {
    if (!SITE_CONFIG.walkinsApiUrl) return;
    var body = { action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    fetch(SITE_CONFIG.walkinsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.walkinSyncError = null;
      renderViews();
    }).catch(function () {
      state.walkinSyncError = "Could not save that change to the server — check your connection and try again.";
      renderViews();
    });
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
    if (!SITE_CONFIG.sponsorsApiUrl) return;
    var body = { action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    fetch(SITE_CONFIG.sponsorsApiUrl, {
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
    pushSponsorToServer("clear", {});
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
        " from the server. This cannot be undone."]),
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
        " from the server. This cannot be undone."]),
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
    // sponsor-submissions.json. The from=app marker tells that page a
    // successful submission came from inside this app (vs. a link on
    // ClubExpress/the club's main site) — see its post-submit redirect.
    var addBtn = el("button", { class: "btn primary" }, ["+ Add Sponsor"]);
    addBtn.addEventListener("click", function () { window.open("sponsor-form.php?from=app", "_blank", "noopener"); });
    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", printSponsors);
    var delBtn = el("button", { class: "btn", id: "sponsorDeleteBtn", disabled: "disabled" }, ["🗑 Delete"]);
    delBtn.addEventListener("click", openDeleteSelectedConfirm);
    var zoomOut = el("button", { class: "btn", title: "Zoom out" }, ["−"]);
    zoomOut.addEventListener("click", function () { setSponsorZoom(state.sponsorZoom - 0.1); });
    var zoomIn = el("button", { class: "btn", title: "Zoom in" }, ["+"]);
    zoomIn.addEventListener("click", function () { setSponsorZoom(state.sponsorZoom + 0.1); });
    var zoomFit = el("button", { class: "btn", title: "Shrink just enough to fit every column on screen" }, ["Fit"]);
    zoomFit.addEventListener("click", fitSponsorZoom);
    var zoomLabel = el("span", { class: "count", text: Math.round(state.sponsorZoom * 100) + "%" });
    var zoomGroup = el("span", { class: "zoomgroup" }, [zoomOut, zoomLabel, zoomIn, zoomFit]);
    var kids = [search, typeGroup, count, el("span", { class: "spacer" }), zoomGroup];
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
    container.appendChild(el("div", { class: "tablewrap", style: "zoom:" + state.sponsorZoom }, [table]));
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
    { key: "etccMemberName", label: "Member" },
    { key: "individualSponsorshipText", label: "Individual Sponsorship Text" }
  ];
  function blankSponsor() {
    return {
      id: null, name: "", contactPerson: "", phone: "", email: "", address: "", website: "",
      etccMemberName: "", sponsorType: CONFIG.SPONSOR_TYPES[0].key, shirtSize: "",
      individualSponsorshipText: ""
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

  function buildSponsorRecord(editing, fieldEls, typeSel, shirtSel) {
    var name = fieldEls.name.value.trim();
    if (!name) return null;
    return {
      id: editing.id || ("sp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      name: name,
      regDate: editing.regDate || "",
      submittedAt: editing.submittedAt,
      contactPerson: fieldEls.contactPerson.value.trim(),
      phone: fieldEls.phone.value.trim(),
      email: fieldEls.email.value.trim(),
      address: fieldEls.address.value.trim(),
      website: fieldEls.website.value.trim(),
      etccMemberName: fieldEls.etccMemberName.value.trim(),
      individualSponsorshipText: fieldEls.individualSponsorshipText.value.trim(),
      sponsorType: typeSel.value,
      shirtSize: shirtSel.value
    };
  }

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

    var regDateText = editing.regDate || (editing.submittedAt ? fmtDate(editing.submittedAt) : "") || "—";
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Reg Date" }),
      el("div", { class: "form-value", text: regDateText })
    ]));

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

    body.appendChild(el("div", { style: "border-top: 1px solid var(--line); margin: 20px 0; padding-top: 20px" }, [
      el("h4", { text: "Record Payment", style: "margin: 0 0 15px 0; font-size: 13px; color: var(--muted); text-transform: uppercase" })
    ]));

    var paymentTypeSelect = el("select", {});
    ["Cash", "Check", "Credit Card"].forEach(function (t) {
      paymentTypeSelect.appendChild(el("option", { value: t, text: t }));
    });
    if (editing.sponsorType === "individual") paymentTypeSelect.value = "Credit Card";
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Payment Type" }),
      paymentTypeSelect
    ]));

    var paymentAmountInput = el("input", { type: "number", placeholder: "0.00", step: "0.01", min: "0", value: editing.sponsorType === "individual" ? "100" : "" });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Amount" }),
      paymentAmountInput
    ]));

    var paymentDateInput = el("input", { type: "date", value: new Date().toISOString().split("T")[0] });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Date Received" }),
      paymentDateInput
    ]));

    var checkNumInput = el("input", { type: "text", placeholder: "Check #" });
    var checkNumRow = el("div", { class: "form-row", style: "display:" + (paymentTypeSelect.value === "Check" ? "" : "none") }, [
      el("span", { class: "form-label", text: "Check #" }),
      checkNumInput
    ]);
    paymentTypeSelect.addEventListener("change", function () {
      checkNumRow.style.display = paymentTypeSelect.value === "Check" ? "" : "none";
    });
    body.appendChild(checkNumRow);

    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    var autoSaveSponsor = debounce(function () {
      var record = buildSponsorRecord(editing, fieldEls, typeSel, shirtSel);
      if (record) { upsertSponsor(record); renderSponsorsBody(); }
    }, 1500);
    var fieldsToWatch = [fieldEls.name, fieldEls.contactPerson, fieldEls.phone, fieldEls.email, fieldEls.address, fieldEls.website, fieldEls.etccMemberName, fieldEls.individualSponsorshipText, typeSel, shirtSel];
    fieldsToWatch.forEach(function (field) {
      field.addEventListener("input", autoSaveSponsor);
      field.addEventListener("change", autoSaveSponsor);
    });

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () {
      var record = buildSponsorRecord(editing, fieldEls, typeSel, shirtSel);
      if (!record) { errorMsg.textContent = "Sponsor Name is required."; return; }
      upsertSponsor(record);

      var paymentAmount = paymentAmountInput.value.trim();
      if (paymentAmount) {
        var payment = {
          id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          sponsorId: editing.id,
          sponsorName: record.name,
          paymentType: paymentTypeSelect.value,
          checkNum: paymentTypeSelect.value === "Check" ? checkNumInput.value.trim() : "",
          date: paymentDateInput.value,
          amount: Number(paymentAmount),
          recordedAt: new Date().toISOString()
        };
        recordPayment(payment);
      }

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

  // ---------- sponsor payment recording modal ----------
  function closePaymentModal() { state.sponsorPaymentOpen = false; renderPaymentModal(); }

  function renderPaymentModal() {
    var host = $("#paymentHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.sponsorPaymentOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closePaymentModal);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Record Sponsor Payment" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var body = el("div", { class: "modal-body" });
    function row(label, input, required) {
      body.appendChild(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: label + (required ? " *" : "") }),
        input
      ]));
    }

    var sponsorSel = el("select", {});
    sponsorSel.appendChild(el("option", { value: "", text: "— Select Sponsor —" }));
    state.sponsors.forEach(function (s) {
      sponsorSel.appendChild(el("option", { value: s.id, text: s.name }));
    });
    row("Sponsor", sponsorSel, true);

    var typeSel = el("select", {});
    ["Cash", "Check", "Credit Card"].forEach(function (t) {
      typeSel.appendChild(el("option", { value: t, text: t }));
    });
    row("Payment Type", typeSel, true);

    var checkNumInput = el("input", { type: "text", placeholder: "Check #" });
    var checkNumRow = el("div", { class: "form-row", style: "display:none" }, [
      el("span", { class: "form-label", text: "Check #" }),
      checkNumInput
    ]);
    typeSel.addEventListener("change", function () {
      checkNumRow.style.display = typeSel.value === "Check" ? "" : "none";
    });
    body.appendChild(checkNumRow);

    var dateInput = el("input", { type: "date", value: new Date().toISOString().split("T")[0] });
    row("Date Received", dateInput, true);

    var amountInput = el("input", { type: "number", placeholder: "0.00", step: "0.01", min: "0" });
    row("Payment Amount", amountInput, true);

    sponsorSel.addEventListener("change", function () {
      var selectedId = sponsorSel.value;
      if (!selectedId) { typeSel.value = "Cash"; amountInput.value = ""; return; }
      var sponsor = state.sponsors.find(function (s) { return s.id === selectedId; });
      if (sponsor && sponsor.sponsorType === "individual") {
        typeSel.value = "Credit Card";
        amountInput.value = "100";
      } else {
        typeSel.value = "Cash";
        amountInput.value = "";
      }
    });

    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    var recordBtn = el("button", { class: "btn primary" }, ["Record Payment"]);
    recordBtn.addEventListener("click", function () {
      var sponsorId = sponsorSel.value.trim();
      var paymentType = typeSel.value.trim();
      var checkNum = checkNumInput.value.trim();
      var date = dateInput.value.trim();
      var amount = amountInput.value.trim();

      if (!sponsorId || !paymentType || !date || !amount) {
        errorMsg.textContent = "Please fill in all required fields.";
        return;
      }
      if (paymentType === "Check" && !checkNum) {
        errorMsg.textContent = "Check number is required for check payments.";
        return;
      }

      var sponsor = state.sponsors.find(function (s) { return s.id === sponsorId; });
      var payment = {
        id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        sponsorId: sponsorId,
        sponsorName: sponsor ? sponsor.name : "",
        paymentType: paymentType,
        checkNum: paymentType === "Check" ? checkNum : "",
        date: date,
        amount: Number(amount),
        recordedAt: new Date().toISOString()
      };
      recordPayment(payment);
      closePaymentModal();
    });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closePaymentModal);
    body.appendChild(el("div", { class: "settings-actions" }, [recordBtn, cancelBtn]));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closePaymentModal);
    host.appendChild(backdrop);
  }

  function backfillPaymentDefaults() {
    var newPayments = [];

    // Fill missing amounts in existing payments
    state.payments.forEach(function (payment) {
      if (payment.amount === null || payment.amount === undefined || payment.amount === "") {
        var sponsor = state.sponsors.find(function (s) { return s.id === payment.sponsorId; });
        if (sponsor && sponsor.sponsorType === "individual") {
          payment.amount = 100;
        }
      }
    });

    // Create default payment records for individual sponsors without any payments
    state.sponsors.forEach(function (sponsor) {
      if (sponsor.sponsorType === "individual") {
        var hasPayment = state.payments.some(function (p) { return p.sponsorId === sponsor.id; });
        if (!hasPayment && sponsor.regDate) {
          var defaultPayment = {
            id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            sponsorId: sponsor.id,
            sponsorName: sponsor.name,
            paymentType: "Credit Card",
            checkNum: "",
            date: sponsor.regDate,
            amount: 100,
            recordedAt: new Date().toISOString()
          };
          state.payments.push(defaultPayment);
          newPayments.push(defaultPayment);
        }
      }
    });

    // Persist backfilled payments to server
    if (newPayments.length && SITE_CONFIG.sponsorPaymentsApiUrl) {
      newPayments.forEach(function (payment) {
        fetch(SITE_CONFIG.sponsorPaymentsApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", payment: payment })
        }).catch(function () {
          // Silently fail — backfilled data is already in memory
        });
      });
    }
  }

  function backfillIndividualSponsorPayments() {
    var newPayments = [];
    var count = 0;
    state.sponsors.forEach(function (sponsor) {
      if (sponsor.sponsorType === "individual") {
        var hasPayment = state.payments.some(function (p) { return p.sponsorId === sponsor.id; });
        if (!hasPayment && sponsor.regDate) {
          var defaultPayment = {
            id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            sponsorId: sponsor.id,
            sponsorName: sponsor.name,
            paymentType: "Credit Card",
            checkNum: "",
            date: sponsor.regDate,
            amount: 100,
            recordedAt: new Date().toISOString()
          };
          state.payments.push(defaultPayment);
          newPayments.push(defaultPayment);
          count++;
        }
      }
    });

    if (newPayments.length && SITE_CONFIG.sponsorPaymentsApiUrl) {
      newPayments.forEach(function (payment) {
        fetch(SITE_CONFIG.sponsorPaymentsApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", payment: payment })
        }).catch(function () {
          // Silently fail — backfilled data is already in memory
        });
      });
    }

    renderSponsorsBody();
    return "Backfilled " + count + " individual sponsor payment records.";
  }

  function recordPayment(payment) {
    state.payments.push(payment);
    renderViews();
    if (!SITE_CONFIG.sponsorPaymentsApiUrl) return;
    fetch(SITE_CONFIG.sponsorPaymentsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", payment: payment })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.sponsorPaymentError = null;
    }).catch(function () {
      state.sponsorPaymentError = "Could not record payment — check your connection and try again.";
      renderPaymentModal();
    });
  }

  // ---------- "+ Add Registration" form modal (Registration tab) ----------
  // Add-only — there's no dedicated "edit a walk-in" form here. A mistake
  // made while filling this out is corrected afterward via the detail
  // modal's Edit mode (see renderDetailModal/EDITABLE_FIELDS) or, for a
  // wrong Reg Type/regretted entry entirely, the Registration tab's
  // checkbox/bulk-delete + re-adding.
  function openAddRegistration() { state.addRegOpen = true; renderAddRegistrationModal(); }
  function closeAddRegistration() { state.addRegOpen = false; renderAddRegistrationModal(); }

  function renderAddRegistrationModal() {
    var host = $("#addRegHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.addRegOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeAddRegistration);
    var head = el("div", { class: "modal-head" }, [el("h3", { text: "Add Registration" }), el("span", { class: "spacer" }), closeBtn]);

    var body = el("div", { class: "modal-body" });
    function row(label, input, required) {
      body.appendChild(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: label + (required ? " *" : "") }),
        input
      ]));
    }

    var regTypeSel = el("select", {});
    [CONFIG.REG_TYPE.WALKIN_MEMBER, CONFIG.REG_TYPE.WALKIN_NONMEMBER].forEach(function (v) {
      regTypeSel.appendChild(el("option", { value: v, text: v }));
    });
    row("Reg Type", regTypeSel);

    // Walk-In Member only: type a name and pick a match from the imported
    // roster (state.members, from Developer > Import Members) to auto-fill
    // the whole form — Last/First Name, Reg #, and whichever contact
    // fields that roster entry has — same "Last, First" datalist pattern
    // sponsor-form.php's "ETCC Member Name" field uses. Manual entry still
    // works if the person isn't in the roster, or the last import didn't
    // include a given field (left untouched in that case).
    var lookupList = el("datalist", { id: "addRegMemberList" });
    state.members.forEach(function (m) { lookupList.appendChild(el("option", { value: m.name })); });
    var lookupInput = el("input", { type: "text", list: "addRegMemberList", autocomplete: "off", placeholder: "Start typing a last name…" });
    var lookupRow = el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Look Up Member" }), lookupInput]);
    body.appendChild(lookupRow);
    body.appendChild(lookupList);

    var lastNameInput = el("input", { type: "text" });
    row("Last Name", lastNameInput, true);
    var firstNameInput = el("input", { type: "text" });
    row("First Name", firstNameInput);

    lookupInput.addEventListener("input", function () {
      var q = lookupInput.value.trim().toLowerCase();
      var match = state.members.filter(function (m) { return m.name.toLowerCase() === q; })[0];
      if (!match) return;
      lastNameInput.value = match.lastName || "";
      firstNameInput.value = match.firstName || "";
      if (match.memberNumber) regNumberInput.value = match.memberNumber;
      clubNameInput.value = "ETCC"; // every roster entry is, by definition, an ETCC member
      if (match.phone) phoneInput.value = match.phone;
      if (match.email) emailInput.value = match.email;
      if (match.address) addressInput.value = match.address;
      if (match.city) cityInput.value = match.city;
      if (match.state) stateInput.value = match.state;
      if (match.zip) zipInput.value = match.zip;
      if (match.year) yearInput.value = match.year;
      if (match.model) modelInput.value = match.model;
      if (match.color) colorInput.value = match.color;
    });

    // Walk-In Member: officer types (or looks up above) the person's real
    // member number. Walk-In Nonmember: auto-assigned from a numbering pool
    // deliberately separate from the CSV import's own nonmember numbers (see
    // nextAvailableWalkinNumber()) and locked, so two walk-ins added back to
    // back never collide.
    var regNumberInput = el("input", { type: "text" });
    row("Reg #", regNumberInput);
    function syncRegNumberField() {
      lookupRow.style.display = regTypeSel.value === CONFIG.REG_TYPE.WALKIN_MEMBER ? "" : "none";
      if (regTypeSel.value === CONFIG.REG_TYPE.WALKIN_NONMEMBER) {
        regNumberInput.value = String(nextAvailableWalkinNumber());
        regNumberInput.setAttribute("disabled", "disabled");
      } else {
        regNumberInput.value = "";
        regNumberInput.removeAttribute("disabled");
      }
    }
    regTypeSel.addEventListener("change", syncRegNumberField);
    syncRegNumberField();

    var clubNameInput = el("input", { type: "text" });
    row("Club Name", clubNameInput);
    var phoneInput = el("input", { type: "text" });
    row("Phone", phoneInput);
    var emailInput = el("input", { type: "text" });
    row("Email", emailInput);
    var addressInput = el("input", { type: "text" });
    row("Address", addressInput);
    var cityInput = el("input", { type: "text" });
    row("City", cityInput);
    var stateInput = el("input", { type: "text" });
    row("State", stateInput);
    var zipInput = el("input", { type: "text" });
    row("Zip", zipInput);
    var yearInput = el("input", { type: "text" });
    row("Corvette Year", yearInput);
    var modelInput = el("input", { type: "text" });
    row("Model", modelInput);
    var colorInput = el("input", { type: "text" });
    row("Color", colorInput);

    // Total Fee Collected is filled in from Developer > Settings' matching fee
    // whenever In Car Show? changes (still freely editable after that, e.g.
    // for a partial payment or a manually negotiated amount).
    var feeInput = el("input", { type: "text" });
    var inCarShowSel = el("select", {});
    ["No", "Yes"].forEach(function (v) { inCarShowSel.appendChild(el("option", { value: v, text: v })); });
    inCarShowSel.addEventListener("change", function () {
      feeInput.value = String(inCarShowSel.value === "Yes" ? state.appSettings.walkInCarShowFee : state.appSettings.walkInNonCarShowFee);
    });
    row("In Car Show?", inCarShowSel);
    feeInput.value = String(state.appSettings.walkInNonCarShowFee); // matches inCarShowSel's default ("No")

    var shirtSel = el("select", {});
    shirtSel.appendChild(el("option", { value: "", text: "— none —" }));
    Object.keys(CONFIG.freeSizeMap).forEach(function (sz) { shirtSel.appendChild(el("option", { value: sz, text: sz })); });
    row("Free T-Shirt Size", shirtSel);

    row("Total Fee Collected", feeInput);

    var statusSel = el("select", {});
    ["Paid", "Not Paid"].forEach(function (v) { statusSel.appendChild(el("option", { value: v, text: v })); });
    row("Status", statusSel);

    if (state.walkinSyncError) {
      body.appendChild(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.walkinSyncError]));
    }
    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () {
      var lastName = lastNameInput.value.trim();
      if (!lastName) { errorMsg.textContent = "Last Name is required."; return; }
      if (regTypeSel.value === CONFIG.REG_TYPE.WALKIN_MEMBER && !regNumberInput.value.trim()) {
        errorMsg.textContent = "Reg # is required for a Walk-In Member.";
        return;
      }
      var record = LOGIC.buildManualRegistration({
        id: "wk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        regType: regTypeSel.value,
        lastName: lastName,
        firstName: firstNameInput.value.trim(),
        memberNumber: regNumberInput.value.trim(),
        nextAvailableMemberNumber: nextAvailableWalkinNumber(),
        clubName: clubNameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        address: addressInput.value.trim(),
        city: cityInput.value.trim(),
        state: stateInput.value.trim(),
        zip: zipInput.value.trim(),
        year: yearInput.value.trim(),
        model: modelInput.value.trim(),
        color: colorInput.value.trim(),
        inCarShow: inCarShowSel.value,
        freeTShirtSize: shirtSel.value,
        totalFee: feeInput.value.trim(),
        status: statusSel.value,
        regDate: fmtDate(new Date())
      }, CONFIG);
      upsertWalkin(record);
      closeAddRegistration();
      if (state.tab === "reg") renderRegBody();
    });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closeAddRegistration);
    body.appendChild(el("div", { class: "settings-actions" }, [saveBtn, cancelBtn]));

    var modal = el("div", { class: "modal wide" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeAddRegistration);
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

  // Fills one copy of the uploaded Car Show Window Card PDF template
  // (Developer > Settings) with a single registrant's Owner/CarNumber/Year/
  // Model/Generation AcroForm fields, then flattens it (bakes the field
  // values into the page content, removing the interactive form) so it
  // copies cleanly into the merged multi-card document below without any
  // field-name collisions between cards. A field missing from the template
  // (e.g. an officer uploads a template that dropped one) is silently
  // skipped rather than treated as an error — same tolerant-optional-field
  // philosophy as members-import.php's column detection.
  //
  // Text is rendered bold and at a fixed larger size (not the template's own
  // default appearance) — setFontSize() per field plus a single
  // form.updateFieldAppearances(boldFont) call (regenerates every field's
  // appearance stream using that font) right before flatten().
  var WINDOW_CARD_FIELD_FONT_SIZE = 36;
  function fillOneWindowCard(templateBytes, r) {
    var PDFLib = window.PDFLib;
    return PDFLib.PDFDocument.load(templateBytes).then(function (doc) {
      return doc.embedFont(PDFLib.StandardFonts.HelveticaBold).then(function (boldFont) {
        var form = doc.getForm();
        var name = (r["First Name"] || "") + (r["Last Name"] ? " " + r["Last Name"] : "");
        var values = {
          Owner: name,
          CarNumber: String(r["Reg #"] || ""),
          Year: String(r["Year"] || ""),
          Model: String(r["Model"] || ""),
          Generation: String(r["Gen"] || "")
        };
        Object.keys(values).forEach(function (key) {
          try {
            var field = form.getTextField(key);
            field.setText(values[key]);
            field.setFontSize(WINDOW_CARD_FIELD_FONT_SIZE);
          } catch (e) { /* field not in this template */ }
        });
        try {
          form.updateFieldAppearances(boldFont);
          form.flatten();
        } catch (e) { /* leave fields unflattened rather than fail the whole print */ }
        return doc;
      });
    });
  }

  // One registrant's window card — the uploaded Car Show Window Card PDF
  // template (Developer > Settings), filled with that registrant's fields
  // via pdf-lib (vendored client-side; see fillOneWindowCard above). Each
  // filled card is embedded (not just copied) onto its own fresh 8.5x11in
  // landscape output page, scaled down and centered so it occupies at most
  // 75% of that page's width and 75% of its height (whichever is more
  // constraining, so the template's own aspect ratio is preserved rather
  // than stretched) — the template's native page size is a print-shop
  // design canvas much larger than a normal sheet, not meant to be printed
  // at 1:1. One output page per row in `list`, merged into a single
  // multi-page PDF and opened in a new tab (the browser's own PDF viewer
  // handles printing from there — more reliable across browsers than trying
  // to script window.print() against content this app doesn't control the
  // rendering of). Used both by the detail modal's single-row button
  // (printWindowCard, a 1-element wrapper below) and the Registration tab's
  // bulk "Print Window Cards" button (printSelectedWindowCards).
  function printWindowCards(list) {
    if (!list.length) return;
    var pdfName = state.appSettings.windowCardPdf;
    if (!pdfName) {
      alert("No Car Show Window Card template uploaded yet — upload one in Developer > Settings first.");
      return;
    }
    var PDFLib = window.PDFLib;
    if (!PDFLib) {
      alert("PDF library failed to load — try reloading the page.");
      return;
    }
    var SHEET_W = 792; // 11in landscape US Letter, in PDF points (72/in)
    var SHEET_H = 612; // 8.5in
    fetch(pdfName + "?v=" + state.windowCardPdfVersion)
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load the window card template.");
        return res.arrayBuffer();
      })
      .then(function (templateBytes) {
        return PDFLib.PDFDocument.create().then(function (outDoc) {
          var chain = Promise.resolve();
          list.forEach(function (r) {
            chain = chain
              .then(function () { return fillOneWindowCard(templateBytes, r); })
              .then(function (filledDoc) {
                return outDoc.embedPage(filledDoc.getPages()[0]).then(function (embedded) {
                  var scale = Math.min((SHEET_W * 0.75) / embedded.width, (SHEET_H * 0.75) / embedded.height);
                  var w = embedded.width * scale;
                  var h = embedded.height * scale;
                  var page = outDoc.addPage([SHEET_W, SHEET_H]);
                  page.drawPage(embedded, { x: (SHEET_W - w) / 2, y: (SHEET_H - h) / 2, width: w, height: h });
                });
              });
          });
          return chain.then(function () { return outDoc.save(); });
        });
      })
      .then(function (bytes) {
        var blob = new Blob([bytes], { type: "application/pdf" });
        window.open(URL.createObjectURL(blob), "_blank");
      })
      .catch(function (err) {
        alert("Could not generate the window card PDF: " + (err && err.message || err));
      });
  }
  function printWindowCard(r) { printWindowCards([r]); }

  // Registration tab's bulk "Print Window Cards" button — only the checked
  // rows whose In Car Show? is exactly "Yes" actually print; a selected row
  // with any other value is silently skipped (see the toolbar button's own
  // count, which already only counts qualifying rows, so nothing here comes
  // as a surprise at print time).
  function printSelectedWindowCards() {
    var byKey = {};
    allRegistrations().forEach(function (r) { byKey[rowKey(r)] = r; });
    var toPrint = selectedRegKeys()
      .map(function (key) { return byKey[key]; })
      .filter(function (r) { return r && String(r["In Car Show?"]).trim().toLowerCase() === "yes"; });
    if (!toPrint.length) return;
    printWindowCards(toPrint);
  }

  function fmtDate(d) {
    d = d instanceof Date ? d : new Date(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + h + ":" + p(d.getMinutes()) + " " + ap;
  }

  // ---------- header menu (hamburger) / settings ----------
  // Order: Logout, Developer (password-gated — reveals Import Members /
  // Import Registrations / Run Regression Tests / Change Log once unlocked).
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
      var settings = el("button", { class: "hdr-menu-item" }, ["⚙ Settings"]);
      settings.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openSettings(); });
      var regTests = el("button", { class: "hdr-menu-item" }, ["🧪 Run Regression Tests"]);
      regTests.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openSettings(); });
      var changelog = el("button", { class: "hdr-menu-item" }, ["📋 Change Log"]);
      changelog.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openChangelog(); });
      var apiItem = el("button", { class: "hdr-menu-item" }, ["🔌 API"]);
      apiItem.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openApiPage(); });
      return [importMembers, importRegs, settings, regTests, changelog, apiItem];
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
    var logoutItem = el("a", { class: "hdr-menu-item", href: "logout.php" }, ["🚪 Logout"]);
    logoutItem.addEventListener("click", closeMenu);
    var items = [logoutItem].concat(buildDeveloperMenuItems());
    items.forEach(function (it) { menu.appendChild(it); });
    if (state.menuOpen && state.developerOpen && !state.developerUnlocked) {
      var pw = menu.querySelector(".hdr-dev-pw");
      if (pw) pw.focus();
    }
  }

  function openSettings() { state.settingsOpen = true; renderSettingsModal(); }
  function closeSettings() { state.settingsOpen = false; renderSettingsModal(); }

  // Optimistic local update, then push to the server — same pattern as
  // upsertSponsor/upsertWalkin. Every officer viewing the site picks up the
  // new value on their next page load.
  function saveAppSettings(patch) {
    Object.keys(patch).forEach(function (k) { state.appSettings[k] = patch[k]; });
    state.appSettingsSaving = true;
    state.appSettingsError = null;
    state.appSettingsSaved = false;
    renderSettingsModal();
    if (!SITE_CONFIG.appSettingsApiUrl) { state.appSettingsSaving = false; renderSettingsModal(); return; }
    fetch(SITE_CONFIG.appSettingsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", settings: patch })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.appSettingsSaving = false;
      state.appSettingsSaved = true;
      renderSettingsModal();
    }).catch(function () {
      state.appSettingsSaving = false;
      state.appSettingsError = "Could not save — check your connection and try again.";
      renderSettingsModal();
    });
  }

  // Multipart upload (not JSON like every other settings save, since it's a
  // real file) for the Car Show Window Card fillable PDF template — see
  // window-card-pdf.php, which saves it to disk and updates
  // app-settings.json's windowCardPdf key server-side. Same session-cookie
  // auth as every other same-origin write in this app (no password field
  // needed — carshow_authed() checks the session first).
  function uploadWindowCardPdf(file) {
    if (!SITE_CONFIG.windowCardPdfApiUrl) return;
    state.windowCardUploading = true;
    state.windowCardError = null;
    renderSettingsModal();
    var body = new FormData();
    body.append("pdf", file);
    fetch(SITE_CONFIG.windowCardPdfApiUrl, { method: "POST", body: body })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.windowCardUploading = false;
        if (r.ok && r.data && r.data.ok) {
          state.appSettings.windowCardPdf = r.data.windowCardPdf;
          state.windowCardPdfVersion++;
        } else {
          state.windowCardError = (r.data && r.data.error) || "Upload failed.";
        }
        renderSettingsModal();
      })
      .catch(function () {
        state.windowCardUploading = false;
        state.windowCardError = "Could not upload — check your connection and try again.";
        renderSettingsModal();
      });
  }

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

    var body = el("div", { class: "modal-body" });

    // ---- Walk-In Registration Settings ----
    body.appendChild(el("h4", { text: "Walk-In Registration Settings" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["The starting number auto-assigned to a Walk-In Nonmember on the Registration tab's " +
       "“+ Add Registration” form. Separate from the CSV import's own nonmember numbering."]));
    var firstNonMemberInput = el("input", { type: "text", value: String(state.appSettings.walkinFirstNonMember) });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "First NonMember Number" }), firstNonMemberInput
    ]));

    // ---- Car Show Window Card ----
    body.appendChild(el("h4", { text: "Car Show Window Card" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Fillable PDF template for printed window cards (Registration tab's detail modal → " +
       "🪟 Print Window Card). Each registrant's Name, Reg #, Year, Model, and Generation are " +
       "filled into the template's Owner/CarNumber/Year/Model/Generation form fields."]));
    if (state.appSettings.windowCardPdf) {
      var windowCardLink = el("a", {
        href: state.appSettings.windowCardPdf + "?v=" + state.windowCardPdfVersion,
        target: "_blank", rel: "noopener", text: "View current template (" + state.appSettings.windowCardPdf + ")"
      });
      body.appendChild(el("div", { style: "margin:6px 0" }, [windowCardLink]));
    } else {
      body.appendChild(el("div", { class: "hint" }, ["No template uploaded yet."]));
    }
    var windowCardFileInput = el("input", { type: "file", accept: "application/pdf" });
    var windowCardUploadBtn = el("button", { class: "btn" }, [state.windowCardUploading ? "Uploading…" : "Upload"]);
    if (state.windowCardUploading) windowCardUploadBtn.setAttribute("disabled", "disabled");
    windowCardUploadBtn.addEventListener("click", function () {
      var f = windowCardFileInput.files && windowCardFileInput.files[0];
      if (!f) { state.windowCardError = "Choose a PDF first."; renderSettingsModal(); return; }
      uploadWindowCardPdf(f);
    });
    body.appendChild(el("div", { class: "form-row" }, [windowCardFileInput, windowCardUploadBtn]));
    if (state.windowCardError) body.appendChild(el("div", { class: "form-error" }, [state.windowCardError]));

    // ---- Registration Fees ----
    body.appendChild(el("h4", { text: "Registration Fees" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["The Add Registration form's Total Fee Collected auto-fills from Car Show or Non Car Show " +
       "based on the In Car Show? field (still editable there). Preregistration is a reference figure " +
       "only — CSV-preregistered attendees' fees come from ClubExpress, not this setting."]));
    var carShowFeeInput = el("input", { type: "text", value: String(state.appSettings.walkInCarShowFee) });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Walk-In Car Show Registration" }), carShowFeeInput]));
    var nonCarShowFeeInput = el("input", { type: "text", value: String(state.appSettings.walkInNonCarShowFee) });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Walk-In Non Car Show Registration" }), nonCarShowFeeInput]));
    var preregFeeInput = el("input", { type: "text", value: String(state.appSettings.preregistrationFee) });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Preregistration" }), preregFeeInput]));

    // ---- T-Shirt Vendor ----
    body.appendChild(el("h4", { text: "T-Shirt Vendor" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Reference contact only — not used to send anything automatically anywhere in the app."]));
    var tshirtVendorEmailInput = el("input", { type: "text", value: state.appSettings.tshirtVendorEmail || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Vendor Email" }), tshirtVendorEmailInput]));

    var settingsSaveBtn = el("button", { class: "btn primary" }, [state.appSettingsSaving ? "Saving…" : "Save"]);
    if (state.appSettingsSaving) settingsSaveBtn.setAttribute("disabled", "disabled");
    settingsSaveBtn.addEventListener("click", function () {
      var fields = [
        ["walkinFirstNonMember", firstNonMemberInput, "First NonMember Number"],
        ["walkInCarShowFee", carShowFeeInput, "Walk-In Car Show Registration"],
        ["walkInNonCarShowFee", nonCarShowFeeInput, "Walk-In Non Car Show Registration"],
        ["preregistrationFee", preregFeeInput, "Preregistration"]
      ];
      var patch = {};
      for (var i = 0; i < fields.length; i++) {
        var key = fields[i][0], n = parseInt(fields[i][1].value, 10);
        var min = key === "walkinFirstNonMember" ? 1 : 0;
        if (isNaN(n) || n < min) {
          state.appSettingsError = fields[i][2] + " must be a whole number" + (min ? " greater than 0." : " (0 or more).");
          renderSettingsModal();
          return;
        }
        patch[key] = n;
      }
      var vendorEmail = tshirtVendorEmailInput.value.trim();
      if (vendorEmail && vendorEmail.indexOf("@") === -1) {
        state.appSettingsError = "Vendor Email doesn't look like a valid email address.";
        renderSettingsModal();
        return;
      }
      patch.tshirtVendorEmail = vendorEmail;
      saveAppSettings(patch);
    });
    var settingsActions = [settingsSaveBtn];
    if (state.appSettingsSaved) settingsActions.push(el("span", { class: "count", style: "color:var(--good)" }, ["Saved."]));
    body.appendChild(el("div", { class: "settings-actions" }, settingsActions));
    if (state.appSettingsError) {
      body.appendChild(el("div", { class: "form-error" }, [state.appSettingsError]));
    }

    // ---- Regression Tests ----
    body.appendChild(el("h4", { text: "Regression Tests" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" }, ["Runs this app's fixture-based test suite in this tab. It uses its own sample data and never touches whatever CSVs you currently have loaded."]));
    body.appendChild(el("div", { class: "settings-actions" }, [runBtn, onlyErrLabel]));

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

  // Change Log (Developer submenu) — modeled on
  // SilentAuctionManager's Change Log screen: pulls commit history straight
  // from the public GitHub repo's REST API (no server endpoint of our own
  // needed) and shows the same repo-stats + commit-table shape. Re-fetched
  // fresh every time the modal opens, same as SAM.
  var CHANGELOG_OWNER = "BWERepo";
  var CHANGELOG_REPO = "ETCCCarShow";
  var CHANGELOG_FTP = "ftp.etccapps.com → /apps/carshow/";
  // Basenames ftp-deploy.sh actually uploads (see that file) — used to count
  // "Files Deployed" out of the repo's full file tree.
  var CHANGELOG_DEPLOYED_FILES = [
    "ETCCCarShow.html", "_login.html", "index.php", "lib.php", "sponsor-form.php",
    "sponsor-submissions.php", "registrations-upload.php", "members-import.php",
    "registrations-import.php", "forgot-password.php", "reset-password.php",
    "logout.php", "ETCClogoWhiteBackground.png", ".htaccess"
  ];
  var CHANGELOG_TEXT_EXTS = ["html", "js", "css", "md", "php", "json", "txt", "sh", "htaccess"];

  function openChangelog() {
    state.changelogOpen = true;
    renderChangelogPage();
    loadChangelogData();
  }
  function closeChangelog() { state.changelogOpen = false; renderChangelogPage(); }

  // Exact total commit count via GitHub's pagination Link header: request one
  // commit per page, then read the rel="last" page number (= total commits).
  function fetchTotalCommitCount(base) {
    return fetch(base + "/commits?per_page=1").then(function (res) {
      if (!res.ok) return null;
      var link = res.headers.get("Link");
      if (link) {
        var m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (m) return parseInt(m[1], 10);
      }
      return res.json().then(function (arr) { return Array.isArray(arr) ? arr.length : 0; });
    }).catch(function () { return null; });
  }

  function loadChangelogData() {
    state.changelogLoading = true;
    state.changelogError = null;
    renderChangelogPage();
    var base = "https://api.github.com/repos/" + CHANGELOG_OWNER + "/" + CHANGELOG_REPO;
    var commits, fileCount = "—", deployedCount = "—";

    Promise.all([
      fetch(base + "/commits?per_page=100"),
      fetch(base + "/git/trees/HEAD?recursive=1")
    ]).then(function (results) {
      var commitsRes = results[0], treeRes = results[1];
      if (!commitsRes.ok) throw new Error("GitHub API error: " + commitsRes.status);
      return commitsRes.json().then(function (c) {
        commits = c;
        if (!treeRes.ok) return [];
        return treeRes.json().then(function (tree) {
          var blobs = (tree.tree || []).filter(function (n) { return n.type === "blob"; });
          fileCount = blobs.length;
          deployedCount = blobs.filter(function (n) {
            var name = n.path.split("/").pop();
            return CHANGELOG_DEPLOYED_FILES.indexOf(name) !== -1;
          }).length;
          return blobs.filter(function (n) {
            var ext = n.path.split(".").pop().toLowerCase();
            return CHANGELOG_TEXT_EXTS.indexOf(ext) !== -1;
          });
        });
      });
    }).then(function (textBlobs) {
      return Promise.all(textBlobs.map(function (n) {
        return fetch(base + "/git/blobs/" + n.sha, { headers: { Accept: "application/vnd.github.raw+json" } })
          .then(function (r) { return r.ok ? r.text() : ""; })
          .catch(function () { return ""; });
      }));
    }).then(function (blobTexts) {
      var loc = blobTexts.reduce(function (sum, txt) {
        return sum + (txt.match(/\n/g) || []).length + (txt ? 1 : 0);
      }, 0);
      return fetchTotalCommitCount(base).then(function (totalCommits) {
        state.changelogMeta = {
          repo: CHANGELOG_OWNER + "/" + CHANGELOG_REPO,
          ftp: CHANGELOG_FTP,
          files: String(fileCount),
          filesDeployed: String(deployedCount),
          loc: loc.toLocaleString(),
          totalChanges: (totalCommits != null) ? String(totalCommits) : (commits.length + (commits.length === 100 ? "+" : ""))
        };
        state.changelogCommits = commits.map(function (c) {
          var d = new Date(c.commit.author.date);
          var lines = c.commit.message.split("\n");
          var subject = lines[0];
          var verMatch = subject.match(/\(v[\d.]+\)/);
          var version = verMatch ? verMatch[0].replace(/[()]/g, "") : "";
          var body = lines.slice(1).filter(function (l) {
            return !/^\s*(Co-Authored-By|Signed-off-by):/i.test(l);
          }).join("\n").trim();
          return { sha: c.sha.substring(0, 7), date: d, subject: subject, body: body, version: version, fullSha: c.sha };
        });
        state.changelogLoading = false;
        renderChangelogPage();
      });
    }).catch(function (err) {
      state.changelogLoading = false;
      state.changelogError = "Failed to load change log: " + (err && err.message || err);
      renderChangelogPage();
    });
  }

  function fmtChangelogDate(d) {
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " · " + h + ":" + p(d.getMinutes()) + " " + ap;
  }

  // Full page, not a centered modal — matches SilentAuctionManager, where
  // Change Log is its own nav "screen" rather than a dialog.
  function renderChangelogPage() {
    var host = $("#changelogHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.changelogOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["← Back"]);
    closeBtn.addEventListener("click", closeChangelog);
    var head = el("div", { class: "changelog-page-head" }, [closeBtn, el("h2", { text: "Change Log" })]);

    var body = el("div", { class: "changelog-page-inner" }, []);

    if (state.changelogMeta) {
      var m = state.changelogMeta;
      var statDefs = [
        ["Repository", m.repo], ["FTP Deployment Path", m.ftp], ["Files in Repo", m.files],
        ["Files Deployed", m.filesDeployed], ["Lines of Code", m.loc], ["Total Changes", m.totalChanges]
      ];
      body.appendChild(el("div", { class: "changelog-card" }, [
        el("div", { class: "changelog-meta" }, statDefs.map(function (s) {
          return el("div", {}, [
            el("div", { class: "k" }, [s[0]]),
            el("div", { class: "v" }, [s[1]])
          ]);
        }))
      ]));
    }

    if (state.changelogLoading) {
      body.appendChild(el("div", { class: "hint" }, ["Loading commits…"]));
    } else if (state.changelogError) {
      body.appendChild(el("div", { class: "form-error" }, [state.changelogError]));
    } else if (state.changelogCommits) {
      var table = el("table", { class: "grid" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", {}, ["Date"]), el("th", {}, ["Version"]), el("th", {}, ["Message"]), el("th", {}, ["SHA"])
        ])]),
        el("tbody", {}, state.changelogCommits.map(function (c) {
          var msgKids = [el("div", { style: "font-weight:600" }, [c.subject])];
          if (c.body) msgKids.push(el("div", { class: "changelog-body" }, [c.body]));
          var link = el("a", { href: "https://github.com/" + CHANGELOG_OWNER + "/" + CHANGELOG_REPO + "/commit/" + c.fullSha, target: "_blank", rel: "noopener", class: "changelog-sha" }, [c.sha]);
          return el("tr", {}, [
            el("td", {}, [fmtChangelogDate(c.date)]),
            el("td", {}, c.version ? [el("span", { class: "changelog-ver" }, [c.version])] : []),
            el("td", { style: "white-space:normal" }, msgKids),
            el("td", {}, [link])
          ]);
        }))
      ]);
      body.appendChild(el("div", { class: "changelog-card flush" }, [
        el("div", { class: "changelog-table-wrap" }, [table])
      ]));
    }

    var bodyWrap = el("div", { class: "changelog-page-body" }, [body]);
    var page = el("div", { class: "changelog-page" }, [head, bodyWrap]);
    host.appendChild(page);
  }

  // Developer > API — a full page (same reasoning as Change Log above) for
  // testing/handing out the URL another website uses to read this event's
  // paid registrations. There's no server-side compute for this endpoint to
  // trigger (see syncPaidRegistrationsCache()) — this page just shows the
  // already-live URL/key and lets an officer fire the exact same request an
  // external caller would make.
  function openApiPage() { state.apiPageOpen = true; state.apiTestResult = null; renderApiPage(); }
  function closeApiPage() { state.apiPageOpen = false; renderApiPage(); }

  // The absolute URL another website calls — built from this page's own
  // location so it's correct on any host this app is deployed to, not
  // hardcoded to etccapps.com.
  function apiUrl(key) {
    return location.href.slice(0, location.href.lastIndexOf("/") + 1) +
      "paid-registrations-api.php?key=" + encodeURIComponent(key || "");
  }

  // Fires the literal request an external caller would make — credentials
  // "omit" so this browser's own login session cookie is never sent, same as
  // a cross-origin server would experience (the endpoint only ever checks
  // the API key, never the session, but this keeps the test honest).
  function testApiUrl() {
    state.apiTesting = true;
    state.apiTestResult = null;
    renderApiPage();
    fetch(apiUrl(state.appSettings.externalApiKey), { credentials: "omit" }).then(function (res) {
      return res.text().then(function (text) {
        var pretty = text;
        try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* show raw text as-is */ }
        state.apiTestResult = { status: res.status, ok: res.ok, bodyText: pretty };
        state.apiTesting = false;
        renderApiPage();
      });
    }).catch(function (err) {
      state.apiTestResult = { status: 0, ok: false, bodyText: "Request failed: " + (err && err.message || err) };
      state.apiTesting = false;
      renderApiPage();
    });
  }

  // Rotating generates a brand-new key server-side (see app-settings.php's
  // rotate_api_key action) and immediately invalidates the old one — any
  // website still using the old URL starts getting 401s right away.
  function rotateApiKey() {
    if (!SITE_CONFIG.appSettingsApiUrl) return;
    state.apiRotating = true;
    state.apiRotateError = null;
    renderApiPage();
    fetch(SITE_CONFIG.appSettingsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate_api_key" })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      if (data && data.ok && data.settings && data.settings.externalApiKey) {
        state.appSettings.externalApiKey = data.settings.externalApiKey;
      }
      state.apiRotating = false;
      state.apiTestResult = null;
      renderApiPage();
    }).catch(function () {
      state.apiRotating = false;
      state.apiRotateError = "Could not rotate — check your connection and try again.";
      renderApiPage();
    });
  }

  function renderApiPage() {
    var host = $("#apiHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.apiPageOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["← Back"]);
    closeBtn.addEventListener("click", closeApiPage);
    var head = el("div", { class: "api-page-head" }, [closeBtn, el("h2", { text: "Paid Registrations API" })]);

    var body = el("div", { class: "api-page-inner" });

    body.appendChild(el("div", { class: "api-card" }, [
      el("p", {}, ["Read-only feed for another website to consume. Returns Member Number, First " +
        "Name, Last Name, Phone, and Email for every registration currently showing a Paid status " +
        "(CSV-imported and Walk-In alike). This app pushes a fresh snapshot to the server automatically " +
        "whenever an officer has it open and something paid-related changes, so the feed stays current " +
        "as long as this app gets opened regularly."])
    ]));

    var key = state.appSettings.externalApiKey || "";
    var url = apiUrl(key);
    var urlInput = el("input", { type: "text", readonly: "readonly", value: url, class: "api-url-input" });
    urlInput.addEventListener("click", function () { urlInput.select(); });
    var copyUrlBtn = el("button", { class: "btn" }, ["Copy URL"]);
    copyUrlBtn.addEventListener("click", function () {
      urlInput.select();
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
    });
    body.appendChild(el("div", { class: "api-card" }, [
      el("h4", { text: "URL for the other website to call" }),
      el("div", { class: "form-row" }, [urlInput, copyUrlBtn])
    ]));

    var keyInput = el("input", {
      type: state.apiKeyRevealed ? "text" : "password", readonly: "readonly", value: key, class: "api-url-input"
    });
    var toggleBtn = el("button", { class: "btn" }, [state.apiKeyRevealed ? "Hide" : "Show"]);
    toggleBtn.addEventListener("click", function () { state.apiKeyRevealed = !state.apiKeyRevealed; renderApiPage(); });
    var rotateBtn = el("button", { class: "btn" }, [state.apiRotating ? "Rotating…" : "Rotate Key"]);
    if (state.apiRotating) rotateBtn.setAttribute("disabled", "disabled");
    rotateBtn.addEventListener("click", rotateApiKey);
    var keyCardKids = [
      el("h4", { text: "API Key" }),
      el("div", { class: "hint", style: "margin-bottom:4px" },
        ["Rotating immediately invalidates the old key — update the other website's copy of the URL " +
         "above right after rotating, or its requests will start failing."]),
      el("div", { class: "form-row" }, [keyInput, toggleBtn, rotateBtn])
    ];
    if (state.apiRotateError) keyCardKids.push(el("div", { class: "form-error" }, [state.apiRotateError]));
    body.appendChild(el("div", { class: "api-card" }, keyCardKids));

    var testBtn = el("button", { class: "btn primary" }, [state.apiTesting ? "Testing…" : "Test This URL"]);
    if (state.apiTesting) testBtn.setAttribute("disabled", "disabled");
    testBtn.addEventListener("click", testApiUrl);
    var testCardKids = [
      el("h4", { text: "Test" }),
      el("div", { class: "hint", style: "margin-bottom:4px" },
        ["Fires the exact same request another website would make (no login session involved) and shows the raw response."]),
      el("div", { class: "settings-actions" }, [testBtn])
    ];
    if (state.apiTestResult) {
      var t = state.apiTestResult;
      testCardKids.push(el("div", { class: t.ok ? "test-summary good" : "test-summary warn" }, ["HTTP " + t.status]));
      testCardKids.push(el("pre", { class: "api-response" }, [t.bodyText]));
    }
    body.appendChild(el("div", { class: "api-card" }, testCardKids));

    var bodyWrap = el("div", { class: "api-page-body" }, [body]);
    var page = el("div", { class: "api-page" }, [head, bodyWrap]);
    host.appendChild(page);
  }

  function printTshirtReport() {
    var host = $("#printHost");
    host.innerHTML = "";

    // Get the logo from the header
    var headerLogo = $("header.app img.hdr-logo");
    var logoImg = null;
    if (headerLogo) {
      logoImg = el("img", { src: headerLogo.src, style: "height:60px; margin:0 auto 16px; display:block" });
    }

    var paidRecs = allRegistrations().filter(function (r) {
      return classifyStatus(r["Status"]) === "paid";
    }).sort(function (a, b) {
      var aLast = String(a["Last Name"] || "").toLowerCase();
      var bLast = String(b["Last Name"] || "").toLowerCase();
      if (aLast !== bLast) return aLast < bLast ? -1 : 1;
      var aFirst = String(a["First Name"] || "").toLowerCase();
      var bFirst = String(b["First Name"] || "").toLowerCase();
      return aFirst < bFirst ? -1 : aFirst > bFirst ? 1 : 0;
    });
    var rows = paidRecs.map(function (r) {
      var shirtText = shirtSummaryText(r);
      return el("tr", {}, [
        el("td", { text: r["Last Name"] || "—" }),
        el("td", { text: r["First Name"] || "—" }),
        el("td", { text: shirtText || "—" })
      ]);
    });

    // Header section
    if (logoImg) host.appendChild(logoImg);
    host.appendChild(el("h1", {
      text: "T-Shirt Report",
      style: "text-align:center; margin:0 0 8px 0; font-size:24px"
    }));
    host.appendChild(el("div", {
      text: "Report Date: " + fmtDate(new Date()),
      style: "text-align:center; color:#666; font-size:12px; margin-bottom:16px"
    }));

    host.appendChild(el("table", { class: "matrix" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Last Name" }),
        el("th", { text: "First Name" }),
        el("th", { text: "Shirts" })
      ])]),
      el("tbody", {}, rows)
    ]));
    window.print();
  }

  // T-Shirt Order Email (T-Shirts tab) — Premier/Corporate/Individual sponsor
  // sections plus a combined shirt-count breakdown (see buildTshirtOrderEmailBody()
  // above), sent to the Vendor Email address from Developer > Settings > T-Shirt
  // Vendor. The recipient is deliberately NOT sent from here — send-tshirt-order-
  // email.php reads tshirtVendorEmail from app-settings.json itself, so Settings
  // stays the single source of truth for who this goes to (see that file).
  function sendTshirtOrderEmail() {
    if (!SITE_CONFIG.sendTshirtOrderEmailApiUrl) return;
    if (!state.appSettings.tshirtVendorEmail) {
      state.emailSendError = "No Vendor Email set — add one in Developer > Settings first.";
      renderViews();
      return;
    }
    state.emailSending = true;
    state.emailSendError = null;
    state.emailSent = false;
    renderViews();
    fetch(SITE_CONFIG.sendTshirtOrderEmailApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: state.emailSubject, body: state.emailBody, cc: state.emailCc, bcc: state.emailBcc })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.emailSending = false;
        if (r.ok && r.data && r.data.ok) {
          state.emailSent = true;
        } else {
          state.emailSendError = (r.data && r.data.error) || "Send failed.";
        }
        renderViews();
      })
      .catch(function () {
        state.emailSending = false;
        state.emailSendError = "Could not send — check your connection and try again.";
        renderViews();
      });
  }

  function buildTshirtView() {
    // Initialize defaults if not yet set
    if (!state.emailSubject) state.emailSubject = "ETCC Car Show — T-Shirt Order";

    var wrap = el("div", { class: "tshirt-view" });

    // Total Shirts Needed For Event card (from Summary tab)
    if (state.result && state.result.ok) {
      wrap.appendChild(el("div", { class: "panel" }, [
        el("div", { class: "cards sponsor-cards" }, [
          el("div", { class: "sponsor-card" }, [
            el("div", { class: "sponsor-card-head", text: "Total Shirts Needed For Event" }),
            combinedShirtMatrix(state.result.summary)
          ])
        ])
      ]));
    }

    // Email Composer Section
    var emailSection = el("div", { class: "panel" }, [el("h3", { text: "📧 T-Shirt Order Email" })]);

    var vendorEmail = state.appSettings.tshirtVendorEmail || "";
    emailSection.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "To:" }),
      vendorEmail
        ? el("div", { class: "form-value", text: vendorEmail })
        : el("div", { class: "form-error", text: "No Vendor Email set — add one in Developer > Settings > T-Shirt Vendor first." })
    ]));

    var subjectInput = el("input", { type: "text", value: state.emailSubject || "" });
    subjectInput.addEventListener("input", function () { state.emailSubject = subjectInput.value; });
    emailSection.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "Subject:" }),
      subjectInput
    ]));

    var ccInput = el("input", { type: "text", value: state.emailCc || "", placeholder: "email@example.com" });
    ccInput.addEventListener("input", function () { state.emailCc = ccInput.value; });
    emailSection.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "CC:" }),
      ccInput
    ]));

    var bccInput = el("input", { type: "text", value: state.emailBcc || "", placeholder: "email@example.com" });
    bccInput.addEventListener("input", function () { state.emailBcc = bccInput.value; });
    emailSection.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "BCC:" }),
      bccInput
    ]));

    var defaultBody = buildTshirtOrderEmailBody();
    if (!state.emailBody) state.emailBody = defaultBody;
    var bodyTextarea = el("textarea", { rows: "40", style: "width:100%; font-family:monospace; font-size:13px; padding:8px; border:1px solid #ccc; resize:vertical" });
    bodyTextarea.value = state.emailBody || "";
    bodyTextarea.addEventListener("input", function () { state.emailBody = bodyTextarea.value; });
    emailSection.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "Message Body (editable):" }),
      bodyTextarea
    ]));

    var sendBtn = el("button", { class: "btn primary" }, [state.emailSending ? "Sending…" : "Send"]);
    if (state.emailSending || !vendorEmail) sendBtn.setAttribute("disabled", "disabled");
    sendBtn.addEventListener("click", sendTshirtOrderEmail);
    var actionRow = el("div", { class: "settings-actions" }, [sendBtn]);
    if (state.emailSent) actionRow.appendChild(el("div", { class: "test-summary good", text: "Sent!" }));
    if (state.emailSendError) actionRow.appendChild(el("div", { class: "form-error", text: state.emailSendError }));
    emailSection.appendChild(actionRow);

    wrap.appendChild(emailSection);

    // T-Shirt Report Section — only show if registration data exists
    if (state.result && state.result.ok) {
      var reportSection = el("div", { class: "panel", style: "margin-top:20px" }, [el("h3", { text: "📊 T-Shirt Report" })]);

      var paidRecs = allRegistrations().filter(function (r) {
        return classifyStatus(r["Status"]) === "paid";
      }).sort(function (a, b) {
        var aLast = String(a["Last Name"] || "").toLowerCase();
        var bLast = String(b["Last Name"] || "").toLowerCase();
        if (aLast !== bLast) return aLast < bLast ? -1 : 1;
        var aFirst = String(a["First Name"] || "").toLowerCase();
        var bFirst = String(b["First Name"] || "").toLowerCase();
        return aFirst < bFirst ? -1 : aFirst > bFirst ? 1 : 0;
      });

      if (!paidRecs.length) {
        reportSection.appendChild(el("div", { class: "hint", style: "text-align:center; padding:20px" }, ["No paid registrations."]));
      } else {
        var rows = paidRecs.map(function (r) {
          var shirtText = shirtSummaryText(r);
          return el("tr", {}, [
            el("td", { text: r["Last Name"] || "—" }),
            el("td", { text: r["First Name"] || "—" }),
            el("td", { text: shirtText || "—" })
          ]);
        });
        reportSection.appendChild(el("table", { class: "matrix" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { text: "Last Name" }),
            el("th", { text: "First Name" }),
            el("th", { text: "Shirts" })
          ])]),
          el("tbody", {}, rows)
        ]));
        var printBtn = el("button", { class: "btn", style: "margin-top:16px" }, ["🖨 Print"]);
        printBtn.addEventListener("click", printTshirtReport);
        reportSection.appendChild(printBtn);
      }

      wrap.appendChild(reportSection);
    }

    return wrap;
  }

  function init() {
    document.body.appendChild(el("div", { id: "detailHost" }));
    document.body.appendChild(el("div", { id: "printHost" }));
    document.body.appendChild(el("div", { id: "settingsHost" }));
    document.body.appendChild(el("div", { id: "changelogHost" }));
    document.body.appendChild(el("div", { id: "apiHost" }));
    document.body.appendChild(el("div", { id: "sponsorFormHost" }));
    document.body.appendChild(el("div", { id: "paymentHost" }));
    document.body.appendChild(el("div", { id: "addRegHost" }));
    document.body.appendChild(el("div", { id: "confirmHost" }));
    // window.__carshowSite is set (by index.php, before this script runs) —
    // see the declaration comment near SITE_CONFIG above. Read it here, not
    // at module-load time, since init() is what's guaranteed to run after
    // every inline script in the document.
    SITE_CONFIG = window.__carshowSite || {};
    // sponsor-form.php redirects here with #sponsors after a successful
    // submission (opened in its own tab from the Sponsors tab's "+ Add
    // Sponsor" button) — land on a fresh Sponsors tab, already showing the
    // new submission, instead of the default Summary tab.
    if (location.hash === "#sponsors") state.tab = "sponsors";
    buildHeaderMenu();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.settingsOpen) { closeSettings(); return; }
      if (e.key === "Escape" && state.changelogOpen) { closeChangelog(); return; }
      if (e.key === "Escape" && state.apiPageOpen) { closeApiPage(); return; }
      if (e.key === "Escape" && state.sponsorEditing) { closeSponsorForm(); return; }
      if (e.key === "Escape" && state.addRegOpen) { closeAddRegistration(); return; }
      if (e.key === "Escape" && state.clearSponsorsOpen) { closeClearSponsorsConfirm(); return; }
      if (e.key === "Escape" && state.deleteSelectedOpen) { closeDeleteSelectedConfirm(); return; }
      if (e.key === "Escape" && state.deleteRegSelectedOpen) { closeDeleteRegSelectedConfirm(); return; }
      if (e.key === "Escape" && state.menuOpen) { closeMenu(); return; }
      if (!state.detailRow) return;
      if (e.key === "Escape") { closeDetail(); }
      else if (e.key === "ArrowLeft") stepDetail(-1);
      else if (e.key === "ArrowRight") stepDetail(1);
    });
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
      regenerate(generatedAt);
    },
    // Called by index.php's boot script with the sponsor list read fresh
    // from the server on this page load.
    ingestSponsors: function (list) {
      state.sponsors = Array.isArray(list) ? list : [];
      renderViews();
    },
    // Called by index.php's boot script with the Walk-In registrations list
    // read fresh from the server on this page load.
    ingestWalkins: function (list) {
      state.walkins = Array.isArray(list) ? list : [];
      renderViews();
    },
    // Called by index.php's boot script with the member roster read fresh
    // from the server on this page load — used by the Add Registration
    // form's member lookup.
    ingestMembers: function (list) {
      state.members = Array.isArray(list) ? list : [];
    },
    // Called by index.php's boot script with sponsor payment records read
    // fresh from the server on this page load.
    ingestPayments: function (list) {
      state.payments = Array.isArray(list) ? list : [];
      backfillPaymentDefaults();
      renderViews();
    },
    // Called by index.php's boot script with app-wide settings read fresh
    // from the server on this page load.
    ingestAppSettings: function (settings) {
      if (settings && typeof settings === "object") {
        Object.keys(settings).forEach(function (k) { state.appSettings[k] = settings[k]; });
      }
    },
    // Called by index.php's boot script, BEFORE ingestRows(), with the set of
    // csvRegKey()s previously deleted via the Registration tab's checkbox
    // bulk-delete — so regenerate() can exclude them the moment the CSV is
    // parsed, not just after the fact.
    ingestDeletedRegistrations: function (keys) {
      state.deletedCsvKeys = {};
      (Array.isArray(keys) ? keys : []).forEach(function (k) { state.deletedCsvKeys[k] = true; });
    },
    // Called by index.php's boot script, BEFORE ingestRows(), with the
    // csvRegKey() -> patch map of prior detail-modal edits to CSV rows.
    ingestRegistrationOverrides: function (overrides) {
      state.csvOverrides = (overrides && typeof overrides === "object") ? overrides : {};
    },
    openAddRegistration: openAddRegistration,
    closeAddRegistration: closeAddRegistration,
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
    openClearSponsorsConfirm: openClearSponsorsConfirm,
    closeClearSponsorsConfirm: closeClearSponsorsConfirm,
    clearAllSponsors: clearAllSponsors,
    setSponsorSelected: setSponsorSelected,
    toggleSelectAllSponsors: toggleSelectAllSponsors,
    openDeleteSelectedConfirm: openDeleteSelectedConfirm,
    closeDeleteSelectedConfirm: closeDeleteSelectedConfirm,
    deleteSelectedSponsors: deleteSelectedSponsors,
    backfillIndividualSponsorPayments: backfillIndividualSponsorPayments
  };
  return (window.CarShow = API);
})();
