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
    splashOpen: true, // full-page splash shown on every app load, until Continue is clicked
    inCarShowFilter: false, // Registration tab toolbar's "In Car Show" checkbox — when checked, only rows with In Car Show? = Yes are shown
    tab: "sum",
    detailRow: null,  // registration row currently shown in the detail modal, or null
    zoom: 1,          // table zoom level (1 = 100%); lets all columns fit without scrolling
    sponsorZoom: 1,   // sponsor table zoom level
    zoomAutoFitDone: false,        // both tables default to "Fit" once per session (not
    sponsorZoomAutoFitDone: false, // on every tab switch, so a manual zoom choice sticks)
    payments: [],     // sponsor payment records
    menuOpen: false,      // hamburger dropdown
    settingsOpen: false,  // settings modal
    testsPageOpen: false,  // Regression Tests full-page screen (Developer menu)
    testResults: null,    // { results: [{label, ok, expected, actual}], passed, failed } | null
    testRunning: false,
    testOnlyErrors: false,
    sponsors: [],          // filled by ingestSponsors(), called by index.php's boot script
    sponsorsRefreshing: false, // Sponsors tab's "Refresh" button — a fetch in progress
    sponsorSearch: "",
    sponsorTypeFilter: { premier: true, corporate: true, individual: true },
    sponsorPaidFilter: "all", // "all" | "paid" | "unpaid"
    sponsorSortCol: null, // one of SPONSOR_COLS[].key, or null for the default (by name)
    sponsorSortDir: 1,
    sponsorEditing: null,  // sponsor record being added/edited in the form modal, or null
    sponsorPaymentOpen: false, // sponsor payment recording modal
    sponsorPaymentSponsorId: null, // which sponsor the payment modal is for
    sponsorPaymentError: null, // error message in payment modal
    sponsorSyncError: null, // set when a push to the server fails; shown in the Sponsors tab
    clearSponsorsOpen: false, // "Remove All Sponsors" confirmation modal
    sponsorSelected: {},    // id -> true, for the Sponsors tab's row checkboxes
    deleteSelectedOpen: false, // "Delete selected sponsors" confirmation modal
    developerLoginOpen: false, // "Developer Login" full-page screen (see openDeveloperLogin())
    developerVerifying: false, // password check in flight
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
      tshirtVendorEmail: "",
      tshirtEventPurchaseCost: 0,
      sponsorEmailTo: "",
      sponsorEmailCc: "",
      sponsorEmailBcc: "",
      sponsorEmailSubject: "New Sponsor Submission"
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
    emailTo: "",              // editable To recipient; defaulted from tshirtVendorEmail when opened
    emailSubject: "",         // editable; defaulted when T-Shirts tab is opened
    emailBody: "",            // editable; defaulted when T-Shirts tab is opened
    emailCc: "",              // editable CC recipients
    emailBcc: "",             // editable BCC recipients
    emailSending: false,
    emailSendError: null,
    emailSent: false,         // brief "Sent!" confirmation after a successful send
    tshirtOrderPageOpen: false, // T-Shirts tab > "T-Shirt Order Form" full-page screen
    tshirtPurchasePageOpen: false, // T-Shirts tab > "Buy T-Shirt" full-page screen
    tshirtPurchases: [],       // day-of-event walk-up sales — filled by ingestTshirtPurchases()
    tshirtPurchaseName: "",    // Buy T-Shirt form's in-progress Name field
    tshirtPurchaseCost: "",    // Buy T-Shirt form's in-progress Cost field (defaults from settings when opened)
    tshirtPurchaseSize: "",    // Buy T-Shirt form's in-progress T-Shirt Size field (e.g. "Men's Large")
    tshirtPurchasePaymentType: "Cash", // Buy T-Shirt form's in-progress Payment Type field
    tshirtPurchaseCheckNum: "", // Buy T-Shirt form's in-progress Check # field (only used when Payment Type is Check)
    tshirtPurchaseSyncError: null, // set when persisting an add/delete fails
    deletedCsvKeys: {},       // csvRegKey(rec) -> true, for CSV-derived rows removed via the
                               // Registration tab's checkbox/bulk-delete — filled by
                               // ingestDeletedRegistrations(); excluded from state.result.registrations
                               // in regenerate(), so they stay gone across reloads/re-imports too
    deletedSponsorIds: {},    // csvSponsorId(rec) -> true, for CSV-auto-synced sponsor rows (Individual
                               // Sponsorship activity) removed from the Sponsors tab — filled by
                               // ingestDeletedSponsors(); checked by syncSponsorsFromRegistrations() so
                               // a deleted sponsor doesn't just get re-created on the next page load
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
  // The one currency formatter every money value in this app should go
  // through — always 2 decimals, comma-grouped for anything over 999 (e.g.
  // Summary's Total Income), so no field shows a bare "$845" next to
  // another showing "$845.00".
  function fmtMoney(v) { return v === "" || v == null ? "" : "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // Phone display formatting reuses LOGIC.formatPhone (logic.js) — the same
  // function generate() already runs CSV/manual registration phones
  // through — instead of a separate app.js copy, so there's one
  // implementation and one regression-tested set of rules for both.
  // Sponsors' phones (CSV auto-sync, member-sponsor-form.php submissions) never
  // flow through generate(), so this call is still needed for those; for
  // Registration rows it's a harmless no-op re-format of an already-
  // formatted value.
  function fmtPhone(v) { return v == null || v === "" ? v : LOGIC.formatPhone(v); }
  // "Reg Date" comes straight from the ClubExpress CSV export as an unpadded,
  // seconds-included string (e.g. "7/8/2026 7:55:00 AM") — reformat it through
  // fmtDate() (defined below) so it lines up with every other date/time shown
  // in the app (2-digit month/day/hour, no seconds).
  var DATE_COLS = { "Reg Date": 1 };
  function fmtCsvDate(v) {
    if (v == null || v === "") return v;
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return fmtDate(d);
  }
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

  // A money input always shown with a "$" prefix, so every dollar figure an
  // officer types looks like currency, not a bare number (this used to only
  // exist on the Buy T-Shirt Cost field — every other money input lacked it).
  // Returns { input, wrap } — append wrap, read/write input as usual.
  function moneyInput(attrs) {
    attrs = attrs || {};
    attrs.type = attrs.type || "number";
    if (attrs.type === "number") {
      attrs.step = attrs.step || "0.01";
      attrs.min = attrs.min || "0";
    }
    attrs.placeholder = attrs.placeholder || "0.00";
    attrs.style = (attrs.style ? attrs.style + "; " : "") + "padding-left:20px; width:100%";
    var input = el("input", attrs);
    var wrap = el("div", { style: "position:relative; flex:1" }, [
      el("span", { style: "position:absolute; left:8px; top:50%; transform:translateY(-50%); color:#666", text: "$" }),
      input
    ]);
    return { input: input, wrap: wrap };
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
    // A CSV (re)import can introduce brand-new Individual Sponsorship
    // registrants — backfill their payment record (Credit Card/$100/regDate)
    // immediately so the Sponsors tab's payment columns aren't blank until
    // the next full page load re-runs ingestPayments(). See also
    // upsertSponsor()'s own call, which covers the "+ Add Sponsor"/Edit
    // Sponsor path (individual sponsor added directly, not via CSV).
    backfillPaymentDefaults();
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
      if (state.deletedSponsorIds[id]) return;
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

    if (state.splashOpen) {
      app.appendChild(buildSplashPage());
      return;
    }

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

    // Reports tab is just a launcher into the four full-page report screens
    // below; also works without CSV data (each report screen handles its own
    // empty state).
    if (state.tab === "reports") {
      app.appendChild(buildReportsView());
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
    return el("div", { class: "tabs no-print" }, [mk("sum", "Summary"), mk("reg", "Registration"), mk("sponsors", "Sponsors"), mk("tsh", "T-Shirts"), mk("reports", "Reports")]);
  }

  // ---------- Splash page (shown on every app load, before the tabs) ----------
  // Blocks the rest of the app until Continue is clicked. Cancel logs out
  // (same destination as the hamburger menu's Logout). The empty div below
  // the welcome text is deliberate room for additional copy in a later
  // session — leave it in place even if it renders empty for now.
  // Splash copy — plain text, no markdown/bold.
  var SPLASH_COPY = [
    "The ETCC Car Show Manager is a comprehensive application designed to manage every aspect of the ETCC Annual Car Show from a single, centralized system. It streamlines event administration by providing organizers with the tools needed to efficiently coordinate participants, sponsors, registrations, merchandise sales, payments, and reporting throughout the entire event lifecycle.",
    "The system supports both pre-registration and walk-in registration, allowing participants to register before the event or on show day. It maintains detailed records for each participant and vehicle, simplifying check-in, reducing paperwork, and ensuring accurate tracking of entrants. Organizers can quickly search, update, and manage participant information while monitoring registration activity in real time."
  ];

  function buildSplashPage() {
    var bannerImg = window.__carshowSplashBanner
      ? el("img", { src: window.__carshowSplashBanner, class: "splash-banner", alt: "ETCC Car Show" })
      : null;

    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", function () { location.href = "logout.php"; });
    var continueBtn = el("button", { class: "btn primary" }, ["Continue"]);
    continueBtn.addEventListener("click", function () { state.splashOpen = false; renderViews(); });

    // No banner built here anymore — the splash page no longer covers the
    // real header.app bar (see .splash-page in styles.css), so that same
    // hamburger+logo+"Car Show Manager" bar every tab already shows is
    // what's visible above the splash content, instead of a re-built copy.
    var kids = [];
    if (bannerImg) kids.push(bannerImg);
    kids.push(el("div", { class: "splash-extra" }, SPLASH_COPY.map(function (p) { return el("p", { text: p }); })));
    kids.push(el("div", { class: "splash-actions" }, [cancelBtn, continueBtn]));

    return el("div", { class: "splash-page" }, [el("div", { class: "splash-inner" }, kids)]);
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
      addBtn,
      statusGroup,
      count,
      el("span", { class: "spacer" }),
      zoomGroup
    ];
    kids.push(printCardsBtn, delBtn, prn);
    return el("div", { class: "toolbar no-print" }, kids);
  }
  function buildSummaryToolbar() {
    return el("div", { class: "toolbar no-print" }, [el("span", { class: "spacer" })]);
  }

  // ---------- print (Registration tab: print every column, not just what's on screen) ----------
  // The on-screen table deliberately collapses 24 shirt columns into one summary
  // column and only shows what's currently sorted/searched/scrolled — printing
  // should still give a complete paper record, so this builds a separate,
  // print-only table with every column instead of reusing the visible one.
  function clearPrintHost() { var host = $("#printHost"); if (host) host.innerHTML = ""; }

  // Shared logo + centered title header, and a report-date footer, used by
  // every print report below (printRegistration/printSponsors/
  // printTshirtReport/printSummaryReport/printRegistrationReport/
  // printSponsorReport) so they all look like one consistent document. Real
  // "Page n of m" numbering isn't something the app can compute itself —
  // browsers don't expose a total page count to print CSS/JS — so that part
  // is left to the browser's own print dialog "Headers and footers" option,
  // which already prints real page numbers.
  function buildPrintHeader(title) {
    var headerLogo = $("header.app img.hdr-logo");
    var kids = [];
    if (headerLogo) kids.push(el("img", { src: headerLogo.src, class: "print-logo", alt: "ETCC Logo" }));
    kids.push(el("h2", { text: title }));
    return el("div", { class: "print-report-head" }, kids);
  }
  function buildPrintFooter() {
    return el("div", { class: "print-report-foot", text: "Report Date: " + fmtDate(new Date()) });
  }

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
        var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : DATE_COLS[c] ? fmtCsvDate(r[c]) : r[c];
        return el("td", {}, [v == null ? "" : String(v)]);
      });
      cells.push(el("td", { class: "shirtsum" }, [shirtSummaryText(r)]));
      return el("tr", {}, cells);
    }));
    host.appendChild(buildPrintHeader(state.result.meta.title));
    host.appendChild(el("table", { class: "grid" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
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
    setTimeout(function () {
      renderRegBody();
      if (!state.zoomAutoFitDone) { state.zoomAutoFitDone = true; fitZoom(); }
    }, 0);
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
      var isDate = !!DATE_COLS[c];
      rows.sort(function (a, b) {
        var av = a[c], bv = b[c];
        if (num) { av = av === "" || av == null ? -Infinity : Number(av); bv = bv === "" || bv == null ? -Infinity : Number(bv); return (av - bv) * dir; }
        if (isDate) {
          var ad = av ? new Date(av).getTime() : NaN, bd = bv ? new Date(bv).getTime() : NaN;
          ad = isNaN(ad) ? -Infinity : ad; bd = isNaN(bd) ? -Infinity : bd;
          return (ad - bd) * dir;
        }
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
        if (c === "Email" && r[c]) {
          var mailLink = el("a", { href: "mailto:" + r[c], text: r[c] });
          mailLink.addEventListener("click", function (e) { e.stopPropagation(); });
          tr.appendChild(el("td", { class: cls.trim() + pinnedClass(idx + 1) }, [mailLink]));
          return;
        }
        if (c === SHIRTS_COL) { cls = "shirtsum"; v = shirtSummaryText(r); }
        else if (CURRENCY_COLS[c]) { cls = "num"; v = fmtMoney(r[c]); }
        else if (DATE_COLS[c]) { v = fmtCsvDate(r[c]); }
        else if (c === "Phone") { v = fmtPhone(r[c]); }
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
    { title: "Registration", cols: ["Reg Date", "Reg Type", "Status", "Total Fee", "Payment Type", "Check #", "Individual Sponsorship", "Spouse First Name", "#"] },
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
    "Reg #": 1, "Last Name": 1, "First Name": 1, "Club Name": 1, "Status": 1, "Total Fee": 1, "Payment Type": 1, "Check #": 1, "Individual Sponsorship": 1,
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
      } else if (c === "Payment Type") {
        var currentPT = r[c] == null ? "" : String(r[c]);
        input = el("select", {});
        [["", "— none —"], ["Cash", "Cash"], ["Check", "Check"], ["Credit Card", "Credit Card"]].forEach(function (pair) {
          var o = el("option", { value: pair[0], text: pair[1] });
          if (pair[0] === currentPT) o.setAttribute("selected", "selected");
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
      } else if (NUM_EDIT_FIELDS[c]) {
        var moneyField = moneyInput({ type: "text", value: r[c] == null ? "" : String(r[c]) });
        input = moneyField.input;
        fieldEls[c] = input;
        return li(c, "", moneyField.wrap);
      } else {
        input = el("input", { type: "text", value: r[c] == null ? "" : String(r[c]) });
      }
      fieldEls[c] = input;
      return li(c, "", input);
    }
    var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : DATE_COLS[c] ? fmtCsvDate(r[c]) : r[c];
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
    // Total Income = registrations' own Total Fee (s.funds, includes each
    // registrant's own Individual Sponsorship add-on fee, since that's part
    // of their registration) + Premier/Corporate sponsor fees (standalone
    // businesses with no registration of their own) + Walk-In T-Shirt
    // purchases (day-of sales). Individual sponsors are deliberately excluded
    // here — their $100 is already counted once via the registrant's own
    // Total Fee, so adding sponsorStatsByType("individual").total too would
    // double it.
    var sponsorFunds = sponsorStatsByType("premier").total + sponsorStatsByType("corporate").total;
    var tshirtPurchaseTotal = state.tshirtPurchases.reduce(function (sum, p) { return sum + (Number(p.cost) || 0); }, 0);
    var totalIncome = Number(s.funds) + sponsorFunds + tshirtPurchaseTotal;
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
      card("Total Income", fmtMoney(totalIncome))
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
        el("div", { class: "sponsor-card" }, [
          el("div", { class: "sponsor-card-head", text: "Total Shirts Needed For Event" }),
          el("div", { style: "font-size:11px; color:var(--muted); margin:-6px 0 8px", text: "Paid registrations + all sponsors (excludes Walk-In T-Shirt purchases)" }),
          combinedShirtMatrix()
        ])
      ])
    ]));

    // Walk-In T-Shirt purchases, Car Show generations, and Clubs — three
    // unrelated-but-compact panels combined into one row (same "cards
    // sponsor-cards" 3-column layout the Sponsors/Shirts rows above use),
    // each still its own "sponsor-card" with its own head, since side by
    // side by side reads better than three separate full-width panels for
    // tables this short.
    var clubRows = s.clubs.map(function (c) {
      return el("tr", {}, [el("td", { class: "lbl", text: c.name }), el("td", { text: String(c.attendees) })]);
    });
    container.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "cards sponsor-cards" }, [
        el("div", { class: "sponsor-card" }, [
          el("div", { class: "sponsor-card-head", text: "Walk-In T-Shirt Purchases" }),
          el("div", { class: "sponsor-card-stats" }, [
            el("div", {}, [el("div", { class: "stat-v", text: String(state.tshirtPurchases.length) }), el("div", { class: "stat-k", text: "Purchases" })]),
            el("div", {}, [el("div", { class: "stat-v", text: fmtMoney(tshirtPurchaseTotal) }), el("div", { class: "stat-k", text: "Total" })])
          ]),
          tshirtPurchaseSizeMatrix()
        ]),
        el("div", { class: "sponsor-card" }, [
          el("div", { class: "sponsor-card-head", text: "Car Show" }),
          el("div", { style: "margin-bottom:8px" }, ["Judges: " + s.judges]),
          genMatrix(s)
        ]),
        el("div", { class: "sponsor-card" }, [
          el("div", { class: "sponsor-card-head", text: "Clubs" }),
          el("table", { class: "matrix" }, [
            el("thead", {}, [el("tr", {}, [el("th", { class: "lbl", text: "Club" }), el("th", { text: "Attendees" })])]),
            el("tbody", {}, clubRows)
          ])
        ])
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

  // Appends "Total Men's" / "Total Women's" / "Grand Total" columns (row-wise
  // sums, using each group's gender) and a bottom "Total" footer row
  // (column-wise sums) — shared by every shirt-size matrix on the Summary/
  // T-Shirts tabs so they all present totals the same way.
  function withShirtMatrixTotals(head, sizeRows, groups) {
    head.appendChild(el("th", { text: "Total Men's" }));
    head.appendChild(el("th", { text: "Total Women's" }));
    head.appendChild(el("th", { text: "Grand Total" }));
    var colTotals = groups.map(function () { return 0; });
    var mensTotal = 0, womensTotal = 0;
    var body = sizeRows.map(function (row) {
      var mensSum = 0, womensSum = 0;
      row.vals.forEach(function (val, i) {
        colTotals[i] += val;
        if (groups[i].gender === "Men's") mensSum += val; else womensSum += val;
      });
      mensTotal += mensSum;
      womensTotal += womensSum;
      row.cells.push(el("td", { class: mensSum ? "" : "z", text: String(mensSum) }));
      row.cells.push(el("td", { class: womensSum ? "" : "z", text: String(womensSum) }));
      row.cells.push(el("td", { class: (mensSum + womensSum) ? "" : "z", text: String(mensSum + womensSum) }));
      return el("tr", {}, row.cells);
    });
    var footerCells = [el("td", { class: "lbl", text: "Total" })];
    colTotals.forEach(function (t) { footerCells.push(el("td", { style: "font-weight:600", text: String(t) })); });
    footerCells.push(el("td", { style: "font-weight:600", text: String(mensTotal) }));
    footerCells.push(el("td", { style: "font-weight:600", text: String(womensTotal) }));
    footerCells.push(el("td", { style: "font-weight:600", text: String(mensTotal + womensTotal) }));
    body.push(el("tr", {}, footerCells));
    return body;
  }
  function shirtMatrix(s) {
    var C = CONFIG;
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" })].concat(
      C.GROUPS.map(function (g) { return el("th", { text: g.label }); })));
    var sizeRows = C.SIZES.map(function (sz) {
      var vals = C.GROUPS.map(function (g) { return s.shirtTotals[g.key + sz.key] || 0; });
      var cells = [el("td", { class: "lbl", text: sz.label })].concat(
        vals.map(function (val) { return el("td", { class: val ? "" : "z", text: String(val) }); }));
      return { cells: cells, vals: vals };
    });
    var body = withShirtMatrixTotals(head, sizeRows, C.GROUPS);
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
  // Purchase-size counts for Walk-In T-Shirt sales (Buy T-Shirt screen) —
  // each purchase's size is one of CONFIG.SPONSOR_SHIRT_SIZES's "Men's/
  // Women's <size>" strings (same set used by the Sponsors tab's T-Shirt
  // field), so CONFIG.SPONSOR_SIZE_INDEX maps it straight to { gender,
  // sizeKey }. Shared by combinedShirtMatrix() and tshirtPurchaseSizeMatrix().
  function tshirtPurchaseShirtCounts() {
    var C = CONFIG;
    var counts = {};
    C.SIZES.forEach(function (sz) { counts[sz.key] = { mens: 0, womens: 0 }; });
    state.tshirtPurchases.forEach(function (p) {
      var info = p.size && C.SPONSOR_SIZE_INDEX[p.size];
      if (!info || !counts[info.sizeKey]) return;
      if (info.gender === "Men's") counts[info.sizeKey].mens++; else counts[info.sizeKey].womens++;
    });
    return counts;
  }

  // Appends a "Grand Total" column (Men's + Women's, per row) and a bottom
  // "Total" footer row (Men's/Women's/Grand Total column sums) to a plain
  // Size/Men's/Women's matrix — shared by every such table on the Summary
  // tab (combinedShirtMatrix, tshirtPurchaseSizeMatrix, sponsorSummaryCard).
  function withGenderMatrixTotals(head, rows) {
    head.appendChild(el("th", { text: "Grand Total" }));
    var mensTotal = 0, womensTotal = 0;
    var body = rows.map(function (row) {
      mensTotal += row.mens;
      womensTotal += row.womens;
      row.cells.push(el("td", { class: (row.mens + row.womens) ? "" : "z", text: String(row.mens + row.womens) }));
      return el("tr", {}, row.cells);
    });
    body.push(el("tr", {}, [
      el("td", { class: "lbl", text: "Total" }),
      el("td", { style: "font-weight:600", text: String(mensTotal) }),
      el("td", { style: "font-weight:600", text: String(womensTotal) }),
      el("td", { style: "font-weight:600", text: String(mensTotal + womensTotal) })
    ]));
    return body;
  }
  // Registration shirtTotals, scoped to only registrations whose Status
  // classifies as "paid" — shared by combinedShirtMatrix() and
  // tshirtOrderShirtCounts() (the T-Shirt Order Email) so both agree on
  // what "how many shirts do we actually need to order" means: don't count
  // someone who never completed payment.
  function paidRegShirtTotals() {
    var paidRows = allRegistrations().filter(function (r) { return classifyStatus(r["Status"]) === "paid"; });
    return LOGIC.summarizeRecords(paidRows, CONFIG).shirtTotals;
  }
  // Paid-registration shirts (Free+Xtra collapsed to just gender) plus
  // sponsor shirts, per size — deliberately excludes Walk-In T-Shirt
  // purchases (those are day-of-event sales already fulfilled on the spot,
  // not part of what needs to be ordered ahead of time) — as opposed to the
  // registration-only breakdown in shirtMatrix() (which is unfiltered).
  function combinedShirtMatrix() {
    var C = CONFIG;
    var totals = paidRegShirtTotals();
    var sponsorCounts = allSponsorShirtCounts();
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" }), el("th", { text: "Men's" }), el("th", { text: "Women's" })]);
    var rows = C.SIZES.map(function (sz) {
      var regMens = 0, regWomens = 0;
      C.GROUPS.forEach(function (g) {
        var val = totals[g.key + sz.key] || 0;
        if (g.gender === "Men's") regMens += val; else regWomens += val;
      });
      var mens = regMens + sponsorCounts[sz.key].mens;
      var womens = regWomens + sponsorCounts[sz.key].womens;
      var cells = [
        el("td", { class: "lbl", text: sz.label }),
        el("td", { class: mens ? "" : "z", text: String(mens) }),
        el("td", { class: womens ? "" : "z", text: String(womens) })
      ];
      return { cells: cells, mens: mens, womens: womens };
    });
    var body = withGenderMatrixTotals(head, rows);
    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, body)]);
  }

  // Size breakdown for Walk-In T-Shirt purchases (Summary tab).
  function tshirtPurchaseSizeMatrix() {
    var C = CONFIG;
    var counts = tshirtPurchaseShirtCounts();
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" }), el("th", { text: "Men's" }), el("th", { text: "Women's" })]);
    var rows = C.SIZES.map(function (sz) {
      var mens = counts[sz.key].mens, womens = counts[sz.key].womens;
      var cells = [
        el("td", { class: "lbl", text: sz.label }),
        el("td", { class: mens ? "" : "z", text: String(mens) }),
        el("td", { class: womens ? "" : "z", text: String(womens) })
      ];
      return { cells: cells, mens: mens, womens: womens };
    });
    var body = withGenderMatrixTotals(head, rows);
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
    var totals = paidRegShirtTotals();
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
    return state.sponsors
      .filter(function (sp) { return sp.sponsorType === typeKey; })
      .slice()
      .sort(function (a, b) { return sponsorSortValue(a, "regDate") - sponsorSortValue(b, "regDate"); });
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
      return sp.individualSponsorshipText || sp.name;
    });
    section("CORPORATE SPONSORS", tshirtEmailSponsorList("corporate"), function (sp) {
      return sp.individualSponsorshipText || sp.name;
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
    { key: "etccMemberName", label: "Member" },
    { key: "regDate", label: "Reg Date" },
    { key: "sponsorType", label: "Sponsor Type" },
    { key: "lastPaymentDate", label: "Payment Date" },
    { key: "lastPaymentType", label: "Type" },
    { key: "lastPaymentCheckNum", label: "Check #" },
    { key: "lastPaymentAmount", label: "Paid" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "website", label: "Website" },
    { key: "individualSponsorshipText", label: "T-Shirt Text" },
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
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" }), el("th", { text: "Men's" }), el("th", { text: "Women's" })]);
    var rows = CONFIG.SIZES.map(function (sz) {
      var c = stats.sizeCounts[sz.key];
      var cells = [
        el("td", { class: "lbl", text: sz.label }),
        el("td", { class: c.mens ? "" : "z", text: String(c.mens) }),
        el("td", { class: c.womens ? "" : "z", text: String(c.womens) })
      ];
      return { cells: cells, mens: c.mens, womens: c.womens };
    });
    var body = withGenderMatrixTotals(head, rows);
    var table = el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, body)]);
    return el("div", { class: "sponsor-card" }, [
      el("div", { class: "sponsor-card-head", text: stats.label + " Sponsors" }),
      el("div", { class: "sponsor-card-stats" }, [
        el("div", {}, [el("div", { class: "stat-v", text: String(stats.count) }), el("div", { class: "stat-k", text: stats.count === 1 ? "Sponsor" : "Sponsors" })]),
        el("div", {}, [el("div", { class: "stat-v", text: fmtMoney(stats.total) }), el("div", { class: "stat-k", text: "Total" })])
      ]),
      table
    ]);
  }
  // See LOGIC.pickLatestPayment's comment (logic.js) for why this sorts by
  // recordedAt rather than date.
  function getLastPaymentForSponsor(sponsorId) {
    var sponsorPayments = state.payments.filter(function (p) { return p.sponsorId === sponsorId; });
    return LOGIC.pickLatestPayment(sponsorPayments);
  }
  // True when there's no payment on file yet, or the last one's amount is 0 —
  // the Sponsors table shows a "Mark Paid…" button in the Amount column for
  // these, opening Edit Sponsor's Record Payment section so an officer can
  // enter the actual amount/type/check # instead of assuming a default.
  function sponsorAmountIsZero(s) {
    var payment = getLastPaymentForSponsor(s.id);
    return !payment || !payment.amount || Number(payment.amount) === 0;
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
    // it uses member-sponsor-form.php's submittedAt (ISO string) instead, formatted
    // to match. Manually-added sponsors with neither show blank.
    if (colKey === "regDate") {
      if (s.regDate) return fmtCsvDate(s.regDate);
      if (s.submittedAt) return fmtDate(s.submittedAt);
      return "";
    }
    if (colKey === "phone") return fmtPhone(s.phone) || "";
    var v = s[colKey];
    return v == null ? "" : String(v);
  }
  // Column-specific sort values: dates/amounts compare numerically (via their
  // underlying Date/Number, not their formatted display string — sorting
  // "$100.00" vs "$20.00" as text would put $100 first), everything else
  // falls back to sponsorFieldText()'s lowercased display string.
  function sponsorSortValue(s, colKey) {
    if (colKey === "regDate") {
      var raw = s.regDate || s.submittedAt;
      var d = raw ? new Date(raw) : null;
      return d && !isNaN(d.getTime()) ? d.getTime() : -Infinity;
    }
    if (colKey === "lastPaymentDate" || colKey === "lastPaymentAmount") {
      var payment = getLastPaymentForSponsor(s.id);
      if (colKey === "lastPaymentAmount") return payment ? Number(payment.amount) || 0 : 0;
      return payment && payment.date ? parseMaybeDateOnly(payment.date).getTime() : -Infinity;
    }
    return sponsorFieldText(s, colKey).toLowerCase();
  }
  function sortedSponsors() {
    var col = state.sponsorSortCol, dir = state.sponsorSortDir;
    return state.sponsors.slice().sort(function (a, b) {
      if (col) {
        var av = sponsorSortValue(a, col), bv = sponsorSortValue(b, col);
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      }
      var an = (a.name || "").toLowerCase(), bn = (b.name || "").toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }
  function visibleSponsors() {
    var q = state.sponsorSearch.trim().toLowerCase();
    var list = sortedSponsors().filter(function (s) { return state.sponsorTypeFilter[s.sponsorType] !== false; });
    if (state.sponsorPaidFilter === "unpaid") list = list.filter(sponsorAmountIsZero);
    else if (state.sponsorPaidFilter === "paid") list = list.filter(function (s) { return !sponsorAmountIsZero(s); });
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
    // Covers a brand-new Individual Sponsorship added directly (Edit Sponsor
    // modal's Save, or a member-sponsor-form.php submission ingested via
    // ingestSponsors) — backfillPaymentDefaults() no-ops for sponsors that
    // already have a payment record, so this is safe to call unconditionally.
    backfillPaymentDefaults();
  }
  // CSV-auto-synced sponsors (id shape "csvind_..." — see csvSponsorId()) have
  // no server record of their own to delete; sponsor-submissions.php's
  // "delete" is a no-op for them. Without also recording the id as deleted,
  // syncSponsorsFromRegistrations() would just re-create the row on the very
  // next page load, since the underlying registration's Individual
  // Sponsorship fee is still there. Web-submitted/manually-added sponsors
  // don't need this — they're never re-synced, so a plain server delete is
  // permanent for them already.
  function removeSponsor(id) {
    state.sponsors = state.sponsors.filter(function (s) { return s.id !== id; });
    pushSponsorToServer("delete", { id: id });
    if (String(id).indexOf("csvind_") === 0) {
      state.deletedSponsorIds[id] = true;
      pushDeletedSponsorsToServer([id]);
    }
  }
  function pushDeletedSponsorsToServer(ids) {
    if (!SITE_CONFIG.deletedSponsorsApiUrl) return;
    fetch(SITE_CONFIG.deletedSponsorsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ids: ids })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.sponsorSyncError = null;
    }).catch(function () {
      state.sponsorSyncError = "Could not save that deletion to the server — it'll reappear if the page is reloaded before this succeeds. Check your connection and try again.";
      if (state.tab === "sponsors") renderViews();
    });
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

  // ---------- t-shirt purchases (T-Shirts tab's "🛒 Buy T-Shirt") ----------
  // Same optimistic-local-update-then-server-push pattern as sponsors/walkins
  // above — see upsertSponsor/pushSponsorToServer's comments.
  function upsertTshirtPurchase(record) {
    var idx = -1;
    state.tshirtPurchases.forEach(function (p, i) { if (p.id === record.id) idx = i; });
    if (idx === -1) state.tshirtPurchases.push(record); else state.tshirtPurchases[idx] = record;
    pushTshirtPurchaseToServer("upsert", { purchase: record });
  }
  function removeTshirtPurchase(id) {
    state.tshirtPurchases = state.tshirtPurchases.filter(function (p) { return p.id !== id; });
    pushTshirtPurchaseToServer("delete", { id: id });
  }
  function pushTshirtPurchaseToServer(action, payload) {
    if (!SITE_CONFIG.tshirtPurchasesApiUrl) return;
    var body = { action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    fetch(SITE_CONFIG.tshirtPurchasesApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.tshirtPurchaseSyncError = null;
      renderTshirtPurchasePage();
    }).catch(function () {
      state.tshirtPurchaseSyncError = "Could not save that change to the server — check your connection and try again.";
      renderTshirtPurchasePage();
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

  // Re-fetches sponsors, their deleted-CSV-sponsor tombstones, and payments —
  // the three pieces of server state the Sponsors tab depends on — and
  // re-renders in place. Deliberately NOT a location.reload(): a full reload
  // re-runs the whole app boot, which shows the splash screen first (see
  // init()), which is jarring for what's meant to be a quick "did someone
  // else just add a sponsor" check. Registrations/CSV data is NOT re-fetched
  // here (there's no live endpoint for it — see index.php's boot script) so
  // syncSponsorsFromRegistrations() re-runs against whatever CSV is already
  // loaded in this tab, same as it would on a normal page load.
  function refreshSponsorsFromServer() {
    if (!SITE_CONFIG.sponsorsApiUrl) return;
    state.sponsorsRefreshing = true;
    state.sponsorSyncError = null;
    renderViews();
    var fetchJson = function (url, action) {
      if (!url) return Promise.resolve(null);
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action })
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };
    Promise.all([
      fetchJson(SITE_CONFIG.sponsorsApiUrl, "list"),
      fetchJson(SITE_CONFIG.deletedSponsorsApiUrl, "list"),
      fetchJson(SITE_CONFIG.sponsorPaymentsApiUrl, "list")
    ]).then(function (results) {
      var sponsorsRes = results[0], deletedRes = results[1], paymentsRes = results[2];
      if (sponsorsRes && sponsorsRes.ok) state.sponsors = Array.isArray(sponsorsRes.sponsors) ? sponsorsRes.sponsors : [];
      if (deletedRes && deletedRes.ok) {
        state.deletedSponsorIds = {};
        (Array.isArray(deletedRes.ids) ? deletedRes.ids : []).forEach(function (id) { state.deletedSponsorIds[id] = true; });
      }
      if (paymentsRes && paymentsRes.ok) state.payments = Array.isArray(paymentsRes.payments) ? paymentsRes.payments : [];
      syncSponsorsFromRegistrations();
      if (paymentsRes && paymentsRes.ok) backfillPaymentDefaults();
      state.sponsorsRefreshing = false;
      renderViews();
    }).catch(function () {
      state.sponsorsRefreshing = false;
      state.sponsorSyncError = "Could not refresh from the server — check your connection and try again.";
      renderViews();
    });
  }

  // ---------- remove all sponsors ----------
  function openClearSponsorsConfirm() { state.clearSponsorsOpen = true; renderClearSponsorsConfirm(); }
  function closeClearSponsorsConfirm() { state.clearSponsorsOpen = false; renderClearSponsorsConfirm(); }
  function clearAllSponsors() {
    // Same csvind_-tombstoning removeSponsor() does for a single delete —
    // otherwise every CSV-auto-synced sponsor would just reappear on the next
    // page load (see removeSponsor()'s comment).
    var csvIds = state.sponsors
      .map(function (s) { return s.id; })
      .filter(function (id) { return String(id).indexOf("csvind_") === 0; });
    state.sponsors = [];
    pushSponsorToServer("clear", {});
    if (csvIds.length) {
      csvIds.forEach(function (id) { state.deletedSponsorIds[id] = true; });
      pushDeletedSponsorsToServer(csvIds);
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
    var paidSelect = el("select", {}, [
      el("option", { value: "all", text: "All" }),
      el("option", { value: "paid", text: "Paid" }),
      el("option", { value: "unpaid", text: "Unpaid" })
    ]);
    paidSelect.value = state.sponsorPaidFilter;
    paidSelect.addEventListener("change", function () { state.sponsorPaidFilter = paidSelect.value; renderSponsorsBody(); });
    var paidGroup = el("label", { class: "statusgroup" }, [document.createTextNode("Paid: "), paidSelect]);
    var count = el("span", { class: "count", id: "sponsorcount" });
    // Adding a sponsor goes through the same public "Become a Car Show
    // Sponsor" form (member-sponsor-form.php) anyone else uses, instead of the
    // in-app modal — keeps one path for entries to land in
    // sponsor-submissions.json. The from=app marker tells that page a
    // successful submission came from inside this app (vs. a link on
    // ClubExpress/the club's main site) — see its post-submit redirect.
    var addBtn = el("button", { class: "btn primary" }, ["+ Add Sponsor"]);
    addBtn.addEventListener("click", function () { window.open("member-sponsor-form.php?from=app", "_blank", "noopener"); });
    // Re-fetches just the sponsor-related data in place — NOT a page reload
    // (that briefly shows the splash screen, since every full load starts
    // there). Picks up whatever another officer (or the public sign-up form)
    // has added/changed since this tab was opened.
    var refreshBtn = el("button", { class: "btn", title: "Reload sponsor data from the server" },
      [state.sponsorsRefreshing ? "Refreshing…" : "🔄 Refresh"]);
    if (state.sponsorsRefreshing) refreshBtn.setAttribute("disabled", "disabled");
    refreshBtn.addEventListener("click", refreshSponsorsFromServer);
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
    var kids = [search, typeGroup, paidGroup, count, el("span", { class: "spacer" }), zoomGroup];
    kids.push(delBtn, addBtn, refreshBtn, prn);
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
      .concat(SPONSOR_COLS.map(function (c) {
        var arrow = state.sponsorSortCol === c.key ? (state.sponsorSortDir === 1 ? " ▲" : " ▼") : "";
        var th = el("th", {}, [c.label, el("span", { class: "arrow", text: arrow })]);
        th.addEventListener("click", function () {
          if (state.sponsorSortCol === c.key) state.sponsorSortDir = -state.sponsorSortDir;
          else { state.sponsorSortCol = c.key; state.sponsorSortDir = 1; }
          renderViews();
        });
        return th;
      }))
      .concat([el("th", { class: "no-print", text: "" })]))]);
    var table = el("table", { class: "grid" }, [thead, el("tbody", { id: "sponsorbody" })]);
    container.appendChild(el("div", { class: "tablewrap", style: "zoom:" + state.sponsorZoom }, [table]));
    setTimeout(function () {
      renderSponsorsBody();
      if (!state.sponsorZoomAutoFitDone) { state.sponsorZoomAutoFitDone = true; fitSponsorZoom(); }
    }, 0);
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
      SPONSOR_COLS.forEach(function (c) {
        if (c.key === "lastPaymentAmount" && sponsorAmountIsZero(s)) {
          // Opens a small dedicated payment modal (Payment Type/Check #/
          // Amount only) instead of blindly logging a full-fee Cash payment —
          // an officer needs to record whatever was actually paid, which
          // isn't always the full fee in cash.
          var markPaidBtn = el("button", { class: "btn", style: "padding:2px 8px; font-size:12px" }, ["Mark Paid…"]);
          markPaidBtn.addEventListener("click", function (e) { e.stopPropagation(); openPaymentModal(s); });
          tr.appendChild(el("td", {}, [markPaidBtn]));
        } else if (c.key === "email" && s.email) {
          var mailLink = el("a", { href: "mailto:" + s.email, text: s.email });
          mailLink.addEventListener("click", function (e) { e.stopPropagation(); });
          tr.appendChild(el("td", {}, [mailLink]));
        } else if (c.key === "website" && s.website) {
          var websiteHref = /^https?:\/\//i.test(s.website) ? s.website : "https://" + s.website;
          var siteLink = el("a", { href: websiteHref, target: "_blank", rel: "noopener", text: s.website });
          siteLink.addEventListener("click", function (e) { e.stopPropagation(); });
          tr.appendChild(el("td", {}, [siteLink]));
        } else {
          tr.appendChild(el("td", { text: sponsorFieldText(s, c.key) }));
        }
      });
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
    { key: "individualSponsorshipText", label: "T-Shirt Text" }
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
      individualSponsorshipText: fieldEls.individualSponsorshipText.value.trim() || name,
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
      if (f.key === "individualSponsorshipText") input.setAttribute("placeholder", editing.name || "");
      fieldEls[f.key] = input;
      body.appendChild(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: f.label + (f.required ? " *" : "") }),
        input
      ]));
    });
    fieldEls.name.addEventListener("input", function () {
      fieldEls.individualSponsorshipText.setAttribute("placeholder", fieldEls.name.value.trim());
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

    // Pre-fill from this sponsor's actual payment record (e.g. one already
    // created by backfillPaymentDefaults()) if one exists, instead of always
    // showing generic today's-date/blank fields — so re-opening an already
    // backfilled Individual Sponsorship shows what was actually recorded.
    var existingPayment = editing.id ? getLastPaymentForSponsor(editing.id) : null;

    var paymentTypeSelect = el("select", {});
    // "Unpaid" isn't a real payment method — it's an escape hatch for a
    // payment recorded in error: selecting it and saving records a $0
    // payment, which is exactly what sponsorAmountIsZero() already treats as
    // "no payment on file", so the sponsor flips back to showing "Mark
    // Paid…" in the Sponsors table instead of a wrong amount.
    ["Cash", "Check", "Credit Card", "Unpaid"].forEach(function (t) {
      paymentTypeSelect.appendChild(el("option", { value: t, text: t }));
    });
    if (existingPayment) paymentTypeSelect.value = existingPayment.paymentType;
    else if (editing.sponsorType === "individual") paymentTypeSelect.value = "Credit Card";
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Payment Type" }),
      paymentTypeSelect
    ]));

    var defaultAmount = existingPayment ? existingPayment.amount
      : (editing.sponsorType === "individual" ? "100" : "");
    var paymentAmountField = moneyInput({ value: defaultAmount });
    var paymentAmountInput = paymentAmountField.input;
    var amountRow = el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Amount" }),
      paymentAmountField.wrap
    ]);
    body.appendChild(amountRow);

    var defaultDate = existingPayment ? dateInputValue(existingPayment.date) : new Date().toISOString().split("T")[0];
    var paymentDateInput = el("input", { type: "date", value: defaultDate });
    var dateRow = el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Date Received" }),
      paymentDateInput
    ]);
    body.appendChild(dateRow);

    var checkNumInput = el("input", { type: "text", placeholder: "Check #", value: existingPayment ? (existingPayment.checkNum || "") : "" });
    var checkNumRow = el("div", { class: "form-row", style: "display:" + (paymentTypeSelect.value === "Check" ? "" : "none") }, [
      el("span", { class: "form-label", text: "Check #" }),
      checkNumInput
    ]);
    function syncPaymentRows() {
      var unpaid = paymentTypeSelect.value === "Unpaid";
      checkNumRow.style.display = paymentTypeSelect.value === "Check" ? "" : "none";
      amountRow.style.display = unpaid ? "none" : "";
      dateRow.style.display = unpaid ? "none" : "";
    }
    paymentTypeSelect.addEventListener("change", syncPaymentRows);
    syncPaymentRows();
    body.appendChild(checkNumRow);

    // Individual Sponsorships default to a $100 Credit Card payment — re-apply
    // whenever Sponsor Type changes (not just on initial render), so picking
    // "Individual" while adding a new sponsor also defaults these fields.
    typeSel.addEventListener("change", function () {
      if (typeSel.value === "individual") {
        paymentTypeSelect.value = "Credit Card";
        paymentAmountInput.value = "100";
        syncPaymentRows();
      }
    });

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
      if (paymentTypeSelect.value === "Unpaid") {
        recordPayment({
          id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          sponsorId: editing.id,
          sponsorName: record.name,
          paymentType: "Unpaid",
          checkNum: "",
          date: new Date().toISOString().split("T")[0],
          amount: 0,
          recordedAt: new Date().toISOString()
        });
      } else if (paymentAmount) {
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
  // Opened from the Sponsors table's "Mark Paid…" button — scoped to one
  // already-known sponsor (no sponsor picker), just the fields an officer
  // actually needs at that moment: Payment Type, Check # (Check only), and
  // Amount. Date is always "now" — this modal only exists for logging a
  // payment as it's collected, not backdating one.
  function openPaymentModal(sponsor) {
    state.sponsorPaymentSponsorId = sponsor.id;
    state.sponsorPaymentError = null;
    state.sponsorPaymentOpen = true;
    renderPaymentModal();
  }
  function closePaymentModal() {
    state.sponsorPaymentOpen = false;
    state.sponsorPaymentSponsorId = null;
    renderPaymentModal();
  }

  function renderPaymentModal() {
    var host = $("#paymentHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.sponsorPaymentOpen) return;
    var sponsor = state.sponsors.filter(function (s) { return s.id === state.sponsorPaymentSponsorId; })[0];
    if (!sponsor) { closePaymentModal(); return; }

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closePaymentModal);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Record Payment — " + sponsor.name }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var body = el("div", { class: "modal-body" });
    function row(label, input, required) {
      body.appendChild(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: label + (required ? " *" : "") }),
        input
      ]));
    }

    var typeSel = el("select", {});
    ["Cash", "Check", "Credit Card"].forEach(function (t) {
      typeSel.appendChild(el("option", { value: t, text: t }));
    });
    typeSel.value = sponsor.sponsorType === "individual" ? "Credit Card" : "Cash";
    row("Payment Type", typeSel, true);

    var checkNumInput = el("input", { type: "text", placeholder: "Check #" });
    var checkNumRow = el("div", { class: "form-row", style: "display:" + (typeSel.value === "Check" ? "" : "none") }, [
      el("span", { class: "form-label", text: "Check #" }),
      checkNumInput
    ]);
    typeSel.addEventListener("change", function () {
      checkNumRow.style.display = typeSel.value === "Check" ? "" : "none";
    });
    body.appendChild(checkNumRow);

    var typeCfg = CONFIG.SPONSOR_TYPES.filter(function (t) { return t.key === sponsor.sponsorType; })[0];
    var amountField = moneyInput({ value: typeCfg ? String(typeCfg.fee) : "" });
    var amountInput = amountField.input;
    row("Payment Amount", amountField.wrap, true);

    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    var recordBtn = el("button", { class: "btn primary" }, ["Record Payment"]);
    recordBtn.addEventListener("click", function () {
      var paymentType = typeSel.value.trim();
      var checkNum = checkNumInput.value.trim();
      var amount = amountInput.value.trim();

      if (!paymentType || !amount) {
        errorMsg.textContent = "Please fill in all required fields.";
        return;
      }
      if (paymentType === "Check" && !checkNum) {
        errorMsg.textContent = "Check number is required for check payments.";
        return;
      }

      // date is the full current timestamp (not just a bare YYYY-MM-DD) —
      // this modal only ever logs a payment as it's collected right now, so
      // the date shown should reflect the actual time it was recorded, not
      // just today's date at midnight.
      recordPayment({
        id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        sponsorId: sponsor.id,
        sponsorName: sponsor.name,
        paymentType: paymentType,
        checkNum: paymentType === "Check" ? checkNum : "",
        date: new Date().toISOString(),
        amount: Number(amount),
        recordedAt: new Date().toISOString()
      });
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

  // Same fallback sponsorFieldText() uses for the "Reg Date" column: sponsors
  // synced from a CSV registration have a real regDate string; sponsors added
  // via the external member-sponsor-form.php (or the in-app Add flow) only ever get
  // submittedAt, so fall back to that (formatted to match) rather than
  // silently skipping the backfill for them.
  function sponsorRegDateForPayment(sponsor) {
    if (sponsor.regDate) return String(sponsor.regDate);
    if (sponsor.submittedAt) return fmtDate(sponsor.submittedAt);
    return "";
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
        var regDate = sponsorRegDateForPayment(sponsor);
        if (!hasPayment && regDate) {
          var defaultPayment = {
            id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            sponsorId: sponsor.id,
            sponsorName: sponsor.name,
            paymentType: "Credit Card",
            checkNum: "",
            date: regDate,
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
        var regDate = sponsorRegDateForPayment(sponsor);
        if (!hasPayment && regDate) {
          var defaultPayment = {
            id: "pay" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            sponsorId: sponsor.id,
            sponsorName: sponsor.name,
            paymentType: "Credit Card",
            checkNum: "",
            date: regDate,
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
      var div = el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: label + (required ? " *" : "") }),
        input
      ]);
      body.appendChild(div);
      return div;
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
    // member-sponsor-form.php's "ETCC Member Name" field uses. Manual entry still
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
    row("First Name", firstNameInput, true);

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
    row("Reg #", regNumberInput, true);
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

    // In Car Show? lives right after Reg # since it gates both the fee
    // default below and whether the Vehicle fields (Year/Model/Color) show
    // at all — a walk-in who isn't entering the car show has no vehicle to
    // record.
    var inCarShowSel = el("select", {});
    ["No", "Yes"].forEach(function (v) { inCarShowSel.appendChild(el("option", { value: v, text: v })); });
    inCarShowSel.addEventListener("change", function () {
      feeInput.value = String(inCarShowSel.value === "Yes" ? state.appSettings.walkInCarShowFee : state.appSettings.walkInNonCarShowFee);
      syncVehicleFieldsVisibility();
    });
    row("In Car Show?", inCarShowSel, true);

    var clubNameInput = el("input", { type: "text" });
    row("Club Name", clubNameInput);
    var phoneInput = el("input", { type: "text" });
    row("Phone", phoneInput, true);
    var emailInput = el("input", { type: "text" });
    row("Email", emailInput, true);
    var addressInput = el("input", { type: "text" });
    row("Address", addressInput);
    var cityInput = el("input", { type: "text" });
    row("City", cityInput);
    var stateInput = el("input", { type: "text" });
    row("State", stateInput);
    var zipInput = el("input", { type: "text" });
    row("Zip", zipInput);
    var yearInput = el("input", { type: "text" });
    var yearRow = row("Corvette Year", yearInput);
    var modelInput = el("input", { type: "text" });
    var modelRow = row("Model", modelInput);
    var colorInput = el("input", { type: "text" });
    var colorRow = row("Color", colorInput);
    function syncVehicleFieldsVisibility() {
      var show = inCarShowSel.value === "Yes";
      yearRow.style.display = show ? "" : "none";
      modelRow.style.display = show ? "" : "none";
      colorRow.style.display = show ? "" : "none";
    }
    syncVehicleFieldsVisibility();

    // Total Fee Collected is filled in from Developer > Settings' matching fee
    // whenever In Car Show? changes (still freely editable after that, e.g.
    // for a partial payment or a manually negotiated amount).
    var feeField = moneyInput({ type: "text" });
    var feeInput = feeField.input;
    feeInput.value = String(state.appSettings.walkInNonCarShowFee); // matches inCarShowSel's default ("No")

    row("Total Fee", feeField.wrap);

    // Same Payment Type (Cash/Check/Credit Card) + conditional Check # pattern
    // as Buy T-Shirt and the Sponsors tab's payment forms. "Unpaid" is the
    // same escape hatch used by the Sponsors payment forms (see
    // renderSponsorForm()) — it isn't a real payment method, it just means
    // no payment has been collected yet; Status is derived from it below
    // instead of showing its own separate field.
    var paymentTypeSel = el("select", {});
    ["Unpaid", "Cash", "Check", "Credit Card"].forEach(function (t) { paymentTypeSel.appendChild(el("option", { value: t, text: t })); });
    paymentTypeSel.addEventListener("change", function () {
      checkNumRow.style.display = paymentTypeSel.value === "Check" ? "" : "none";
    });
    row("Payment Type", paymentTypeSel);

    var checkNumInput = el("input", { type: "text" });
    var checkNumRow = el("div", { class: "form-row", style: "display:none" }, [
      el("span", { class: "form-label", text: "Check #" }), checkNumInput
    ]);
    body.appendChild(checkNumRow);

    if (state.walkinSyncError) {
      body.appendChild(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.walkinSyncError]));
    }
    var errorMsg = el("div", { class: "form-error" });
    body.appendChild(errorMsg);

    // Switching Reg Type mid-fill-out usually means the officer picked the
    // wrong one and is starting over — clear every other field rather than
    // leave stale values from the previous type sitting under the new one.
    // syncRegNumberField (registered first, above) already handles Reg #
    // specially, so it's left out here.
    function clearOtherFields() {
      lookupInput.value = "";
      lastNameInput.value = "";
      firstNameInput.value = "";
      clubNameInput.value = "";
      phoneInput.value = "";
      emailInput.value = "";
      addressInput.value = "";
      cityInput.value = "";
      stateInput.value = "";
      zipInput.value = "";
      yearInput.value = "";
      modelInput.value = "";
      colorInput.value = "";
      inCarShowSel.value = "No";
      syncVehicleFieldsVisibility();
      feeInput.value = String(state.appSettings.walkInNonCarShowFee);
      paymentTypeSel.value = "Unpaid";
      checkNumInput.value = "";
      checkNumRow.style.display = "none";
      errorMsg.textContent = "";
    }
    regTypeSel.addEventListener("change", clearOtherFields);

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () {
      var lastName = lastNameInput.value.trim();
      if (!lastName) { errorMsg.textContent = "Last Name is required."; return; }
      if (!firstNameInput.value.trim()) { errorMsg.textContent = "First Name is required."; return; }
      if (!regNumberInput.value.trim()) { errorMsg.textContent = "Reg # is required."; return; }
      if (!phoneInput.value.trim()) { errorMsg.textContent = "Phone is required."; return; }
      if (!emailInput.value.trim()) { errorMsg.textContent = "Email is required."; return; }
      if (paymentTypeSel.value === "Check" && !checkNumInput.value.trim()) {
        errorMsg.textContent = "Check # is required for a Check payment.";
        return;
      }
      // A $0 Total Fee (e.g. a Walk-In not entering the car show) has nothing
      // to actually collect payment for — force Payment Type to Cash rather
      // than leaving it on Unpaid, so it doesn't show as still owing money.
      var effectivePaymentType = (LOGIC.toNum(feeInput.value.trim()) === 0) ? "Cash" : paymentTypeSel.value;
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
        totalFee: feeInput.value.trim(),
        paymentType: effectivePaymentType,
        checkNum: checkNumInput.value.trim(),
        status: effectivePaymentType === "Unpaid" ? "Not Paid" : "Paid",
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
    host.appendChild(buildPrintHeader("Car Show Sponsors"));
    host.appendChild(el("table", { class: "grid" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
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
  var WINDOW_CARD_FIELD_FONT_SIZE = 39.6; // 36 + 10%
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

  // A bare "YYYY-MM-DD" string (what <input type=date> — e.g. the payment
  // date field — produces) is a plain calendar day with no time-of-day
  // attached. new Date("2026-07-12") parses that as UTC midnight, so
  // displaying it with local getters (below) can shift it back to the
  // previous evening in any timezone behind UTC. Parse it as a local date
  // instead so it always shows as midnight on the day actually picked.
  function parseMaybeDateOnly(d) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var parts = d.split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return d instanceof Date ? d : new Date(d);
  }
  function fmtDate(d) {
    d = parseMaybeDateOnly(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return p(d.getMonth() + 1) + "/" + p(d.getDate()) + "/" + d.getFullYear() + " " + p(h) + ":" + p(d.getMinutes()) + " " + ap;
  }

  // Converts any parseable date string/Date (e.g. a raw CSV "Reg Date" like
  // "7/8/2026 7:55:00 AM") into the "YYYY-MM-DD" shape <input type=date>
  // requires — falls back to today if the value can't be parsed.
  function dateInputValue(d) {
    var parsed = parseMaybeDateOnly(d);
    if (isNaN(parsed.getTime())) parsed = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return parsed.getFullYear() + "-" + p(parsed.getMonth() + 1) + "-" + p(parsed.getDate());
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
    // Goes inside .hdr-left (before the logo), not header.firstChild — the
    // header is now a 3-column grid (see header.app in styles.css) and a 4th
    // top-level child here would break the centered title.
    var hdrLeft = header.querySelector(".hdr-left") || header;
    hdrLeft.insertBefore(hamburgerBtn, hdrLeft.firstChild);

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
    if (!state.menuOpen) return;
    state.menuOpen = false;
    renderHeaderMenu();
  }
  // Checks against a SEPARATE Developer password (index.php's action=dev_login,
  // $DEV_PASSWORD_HASH in secrets.php) — a distinct credential from the main
  // site login, without ever exposing either hash to this script. Every
  // Import Members/Registrations link is still independently session-gated
  // server-side using the MAIN login's session (see members-import.php/
  // registrations-import.php) — this step is only about hiding those links
  // from the menu until the Developer password is entered.
  function submitDeveloperPassword(password) {
    return fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "action=dev_login&password=" + encodeURIComponent(password)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.success) {
          state.developerUnlocked = true;
          state.developerLoginOpen = false;
          state.developerError = null;
          renderDeveloperLoginPage();
        } else {
          state.developerError = "Incorrect password.";
          renderDeveloperLoginPage();
        }
        renderHeaderMenu();
      })
      .catch(function () {
        state.developerError = "Could not verify — check your connection and try again.";
        renderDeveloperLoginPage();
      });
  }
  // ---------- Developer Login (full-page screen) ----------
  // Was previously a cramped inline password row inside the hamburger
  // dropdown, with no way to recover from a forgotten/wrong password short
  // of guessing again. Now its own full page (same buildPageBanner pattern
  // as Settings/Change Log/API) with a real "Forgot password?" link to the
  // same reset flow the main login screen already has (forgot-password.php
  // -> emails a time-limited reset link to the club's admin inbox — this
  // site has one shared password, so Developer and the main login gate are
  // literally the same credential; a reset there fixes both).
  function openDeveloperLogin() {
    state.developerLoginOpen = true;
    state.developerError = null;
    renderDeveloperLoginPage();
  }
  function closeDeveloperLogin() { state.developerLoginOpen = false; renderDeveloperLoginPage(); }

  // Same full-screen gradient-card look as _login.html's main site login gate
  // (see .dev-login-* in styles.css) — an in-app overlay, not the app's usual
  // modal or full-page-banner treatment, plus a close (✕) button since this
  // is reachable without leaving the app (the real login page has nothing to
  // "close" back to).
  function renderDeveloperLoginPage() {
    var host = $("#developerLoginHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.developerLoginOpen) return;

    var headerLogo = $("header.app img.hdr-logo");
    var logoImg = headerLogo ? el("img", { src: headerLogo.src, class: "dev-login-logo", alt: "ETCC Logo" }) : null;

    var closeBtn = el("button", { class: "dev-login-close", title: "Cancel" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeveloperLogin);

    var pwInput = el("input", { type: "password", class: "dev-login-input", placeholder: "Enter Developer password" });
    var submit = function () {
      if (!pwInput.value) return;
      state.developerVerifying = true;
      renderDeveloperLoginPage();
      submitDeveloperPassword(pwInput.value).then(function () { state.developerVerifying = false; });
    };
    var goBtn = el("button", { class: "dev-login-btn" }, [state.developerVerifying ? "Checking…" : "Unlock"]);
    if (state.developerVerifying) goBtn.setAttribute("disabled", "disabled");
    goBtn.addEventListener("click", submit);
    pwInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

    var kids = [closeBtn];
    if (logoImg) kids.push(logoImg);
    kids.push(el("h1", { class: "dev-login-title", text: "Developer Login" }));
    kids.push(el("p", { class: "dev-login-subtitle" },
      ["Unlocks Import Members, Import Registrations, Settings, Regression Tests, " +
       "Change Log, and API — a separate password from the main site login."]));
    kids.push(pwInput);
    if (state.developerError) kids.push(el("div", { class: "dev-login-error" }, [state.developerError]));
    kids.push(goBtn);
    kids.push(el("div", { class: "dev-login-hint" }, [
      el("a", { href: "dev-forgot-password.php", target: "_blank", rel: "noopener" }, ["Forgot Developer password?"])
    ]));

    var container = el("div", { class: "dev-login-container" }, kids);
    var screen = el("div", { class: "dev-login-screen" }, [container]);
    host.appendChild(screen);
    pwInput.focus();
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
      regTests.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openTestsPage(); });
      var changelog = el("button", { class: "hdr-menu-item" }, ["📋 Change Log"]);
      changelog.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openChangelog(); });
      var apiItem = el("button", { class: "hdr-menu-item" }, ["🔌 API"]);
      apiItem.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openApiPage(); });
      return [importMembers, importRegs, settings, regTests, changelog, apiItem];
    }
    var devBtn = el("button", { class: "hdr-menu-item" }, ["🛠 Developer"]);
    devBtn.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openDeveloperLogin(); });
    return [devBtn];
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
    // Deliberately no renderSettingsModal() here: this fires on every field's
    // blur, and a synchronous full re-render tears down and rebuilds every
    // input element on the page — which steals focus mid-Tab when a user
    // tabs quickly through several fields in the same card (e.g. New Sponsor
    // Confirmation Email's To/CC/BCC/Subject), so keystrokes typed into the
    // next field land on a DOM node the browser already forgot about and
    // never make it into state. Only re-render once the request actually
    // settles, when there's no in-progress keyboard interaction to disrupt.
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
      renderTestsPage();
      return;
    }
    state.testRunning = true;
    renderTestsPage();
    var F = window.CarShowFixtures;
    var reg = Papa.parse(F.regCsv, { header: true, skipEmptyLines: true }).data;
    var act = Papa.parse(F.actCsv, { header: true, skipEmptyLines: true }).data;
    var built = window.CarShowRegressionTests.assertionList(reg, act);
    return window.CarShowRegressionTests.excelAssertionList(built.out, ExcelJS).then(function (excelResults) {
      var all = built.results.concat(excelResults);
      var passed = all.filter(function (r) { return r.ok; }).length;
      state.testResults = { results: all, passed: passed, failed: all.length - passed };
      state.testRunning = false;
      renderTestsPage();
    }).catch(function (err) {
      state.testResults = { results: built.results.concat([{ label: "Excel round-trip threw", ok: false, expected: "no throw", actual: String(err && err.message || err) }]), passed: 0, failed: 1 };
      state.testRunning = false;
      renderTestsPage();
    });
  }

  // ---------- Regression Tests (full-page screen) ----------
  // Selecting "Run Regression Tests" from the Developer menu opens this page
  // and immediately kicks off a run (rather than opening Settings and making
  // the officer press a separate button) — see PROJECT_STATUS.md.
  function openTestsPage() {
    state.testsPageOpen = true;
    runRegressionTests();
  }
  function closeTestsPage() { state.testsPageOpen = false; renderTestsPage(); }

  function renderTestsPage() {
    var host = $("#testsHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.testsPageOpen) return;

    var head = buildPageBanner(closeTestsPage, "Regression Tests");

    var runBtn = el("button", { class: "btn primary" }, [state.testRunning ? "Running…" : "Run Again"]);
    if (state.testRunning) runBtn.setAttribute("disabled", "disabled");
    runBtn.addEventListener("click", runRegressionTests);

    var onlyErrCb = el("input", { type: "checkbox" });
    onlyErrCb.checked = state.testOnlyErrors;
    onlyErrCb.addEventListener("change", function () { state.testOnlyErrors = onlyErrCb.checked; renderTestsPage(); });
    var onlyErrLabel = el("label", {}, [onlyErrCb, document.createTextNode(" Only show errors")]);

    var body = el("div", { class: "api-page-inner" });
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

    var bodyWrap = el("div", { class: "api-page-body" }, [body]);
    var page = el("div", { class: "api-page" }, [head, bodyWrap]);
    host.appendChild(page);
  }

  function renderSettingsModal() {
    var host = $("#settingsHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.settingsOpen) return;

    var head = buildPageBanner(closeSettings, "Settings");

    var body = el("div", { class: "api-page-inner" });

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
    if (state.windowCardUploading) windowCardFileInput.setAttribute("disabled", "disabled");
    windowCardFileInput.addEventListener("change", function () {
      var f = windowCardFileInput.files && windowCardFileInput.files[0];
      if (!f) return;
      uploadWindowCardPdf(f);
    });
    body.appendChild(el("div", { class: "form-row" }, [windowCardFileInput, state.windowCardUploading ? el("span", { class: "count" }, ["Uploading…"]) : null].filter(Boolean)));
    if (state.windowCardError) body.appendChild(el("div", { class: "form-error" }, [state.windowCardError]));

    // ---- Registration Fees ----
    body.appendChild(el("h4", { text: "Registration Fees" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["The Add Registration form's Total Fee Collected auto-fills from Car Show or Non Car Show " +
       "based on the In Car Show? field (still editable there). Preregistration is a reference figure " +
       "only — CSV-preregistered attendees' fees come from ClubExpress, not this setting."]));
    var carShowFeeField = moneyInput({ type: "text", value: String(state.appSettings.walkInCarShowFee) });
    var carShowFeeInput = carShowFeeField.input;
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Walk-In Car Show Registration" }), carShowFeeField.wrap]));
    var nonCarShowFeeField = moneyInput({ type: "text", value: String(state.appSettings.walkInNonCarShowFee) });
    var nonCarShowFeeInput = nonCarShowFeeField.input;
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Walk-In Non Car Show Registration" }), nonCarShowFeeField.wrap]));
    var preregFeeField = moneyInput({ type: "text", value: String(state.appSettings.preregistrationFee) });
    var preregFeeInput = preregFeeField.input;
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Preregistration" }), preregFeeField.wrap]));

    // ---- T-Shirt Vendor ----
    body.appendChild(el("h4", { text: "T-Shirt Vendor" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Reference contact only — not used to send anything automatically anywhere in the app."]));
    var tshirtVendorEmailInput = el("input", { type: "text", value: state.appSettings.tshirtVendorEmail || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Vendor Email" }), tshirtVendorEmailInput]));
    body.appendChild(el("div", { class: "hint", style: "margin:6px 0 4px" },
      ["Reference figure for officers selling shirts at the event — not applied anywhere automatically."]));
    var tshirtPurchaseCostField = moneyInput({ type: "text", value: String(state.appSettings.tshirtEventPurchaseCost) });
    var tshirtPurchaseCostInput = tshirtPurchaseCostField.input;
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Cost to Purchase at Event" }), tshirtPurchaseCostField.wrap]));

    // ---- New Sponsor Confirmation Email ----
    body.appendChild(el("h4", { text: "New Sponsor Confirmation Email" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Sent whenever a sponsorship is submitted through the public sponsor sign-up form " +
       "(member-sponsor-form.php). Leave To blank to default it to the Member Email entered on " +
       "the form itself; sending is only skipped if both are blank. To/CC/BCC each accept " +
       "multiple comma-separated addresses."]));
    var sponsorEmailToInput = el("input", { type: "text", value: state.appSettings.sponsorEmailTo || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "To" }), sponsorEmailToInput]));
    var sponsorEmailCcInput = el("input", { type: "text", value: state.appSettings.sponsorEmailCc || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "CC" }), sponsorEmailCcInput]));
    var sponsorEmailBccInput = el("input", { type: "text", value: state.appSettings.sponsorEmailBcc || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "BCC" }), sponsorEmailBccInput]));
    var sponsorEmailSubjectInput = el("input", { type: "text", value: state.appSettings.sponsorEmailSubject || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Subject" }), sponsorEmailSubjectInput]));

    // Auto-save: every field above saves itself (no Save button) as soon as
    // it loses focus, validating and building the same full patch each time
    // so unrelated fields stay in sync with whatever's currently on screen.
    function autoSaveSettings() {
      var fields = [
        ["walkinFirstNonMember", firstNonMemberInput, "First NonMember Number"],
        ["walkInCarShowFee", carShowFeeInput, "Walk-In Car Show Registration"],
        ["walkInNonCarShowFee", nonCarShowFeeInput, "Walk-In Non Car Show Registration"],
        ["preregistrationFee", preregFeeInput, "Preregistration"],
        ["tshirtEventPurchaseCost", tshirtPurchaseCostInput, "Cost to Purchase at Event"]
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

      var sponsorEmailFields = [
        ["sponsorEmailTo", sponsorEmailToInput, "To"],
        ["sponsorEmailCc", sponsorEmailCcInput, "CC"],
        ["sponsorEmailBcc", sponsorEmailBccInput, "BCC"]
      ];
      for (var j = 0; j < sponsorEmailFields.length; j++) {
        var addrVal = sponsorEmailFields[j][1].value.trim();
        if (addrVal && addrVal.split(/[,;]+/).some(function (a) { return a.trim() && a.trim().indexOf("@") === -1; })) {
          state.appSettingsError = "New Sponsor Confirmation Email " + sponsorEmailFields[j][2] + " doesn't look like a valid email address.";
          renderSettingsModal();
          return;
        }
        patch[sponsorEmailFields[j][0]] = addrVal;
      }
      patch.sponsorEmailSubject = sponsorEmailSubjectInput.value.trim() || "New Sponsor Submission";
      saveAppSettings(patch);
    }
    [
      firstNonMemberInput, carShowFeeInput, nonCarShowFeeInput, preregFeeInput,
      tshirtVendorEmailInput, tshirtPurchaseCostInput,
      sponsorEmailToInput, sponsorEmailCcInput, sponsorEmailBccInput, sponsorEmailSubjectInput
    ].forEach(function (input) { input.addEventListener("blur", autoSaveSettings); });

    var settingsStatus = [];
    if (state.appSettingsSaving) settingsStatus.push(el("span", { class: "count" }, ["Saving…"]));
    else if (state.appSettingsSaved) settingsStatus.push(el("span", { class: "count", style: "color:var(--good)" }, ["Saved."]));
    if (settingsStatus.length) body.appendChild(el("div", { class: "settings-actions" }, settingsStatus));
    if (state.appSettingsError) {
      body.appendChild(el("div", { class: "form-error" }, [state.appSettingsError]));
    }

    var bodyWrap = el("div", { class: "api-page-body" }, [body]);
    var page = el("div", { class: "api-page" }, [head, bodyWrap]);
    host.appendChild(page);
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
    "ETCCCarShow.html", "_login.html", "index.php", "lib.php", "member-sponsor-form.php",
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
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " · " + p(h) + ":" + p(d.getMinutes()) + " " + ap;
  }

  // Full page, not a centered modal — matches SilentAuctionManager, where
  // Change Log is its own nav "screen" rather than a dialog.
  function renderChangelogPage() {
    var host = $("#changelogHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.changelogOpen) return;

    var head = buildPageBanner(closeChangelog);

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

    var head = buildPageBanner(closeApiPage);

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

    // Same logo/centered-title header, centered table, and report-date
    // footer as printRegistrationReport() — formatted identically.
    host.appendChild(buildPrintHeader("T-Shirt Report"));
    host.appendChild(el("table", { class: "grid report-table centered-report-table" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Last Name" }),
        el("th", { text: "First Name" }),
        el("th", { text: "Shirts" })
      ])]),
      el("tbody", {}, rows)
    ]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // T-Shirt Order Email (T-Shirts tab) — Premier/Corporate/Individual sponsor
  // sections plus a combined shirt-count breakdown (see buildTshirtOrderEmailBody()
  // above). To defaults from the Vendor Email address in Developer > Settings >
  // T-Shirt Vendor but is editable per-send (see state.emailTo) — send-tshirt-
  // order-email.php accepts an explicit "to" and falls back to the configured
  // Vendor Email only if none is supplied.
  function sendTshirtOrderEmail() {
    if (!SITE_CONFIG.sendTshirtOrderEmailApiUrl) return;
    if (!state.emailTo) {
      state.emailSendError = "No recipient set — type a To address, or add one in Developer > Settings first.";
      renderTshirtOrderPage();
      return;
    }
    state.emailSending = true;
    state.emailSendError = null;
    state.emailSent = false;
    renderTshirtOrderPage();
    fetch(SITE_CONFIG.sendTshirtOrderEmailApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: state.emailTo, subject: state.emailSubject, body: state.emailBody, cc: state.emailCc, bcc: state.emailBcc })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.emailSending = false;
        if (r.ok && r.data && r.data.ok) {
          state.emailSent = true;
        } else {
          state.emailSendError = (r.data && r.data.error) || "Send failed.";
        }
        renderTshirtOrderPage();
      })
      .catch(function () {
        state.emailSending = false;
        state.emailSendError = "Could not send — check your connection and try again.";
        renderTshirtOrderPage();
      });
  }

  function buildTshirtView() {
    var wrap = el("div", { class: "view tshirt-view" });

    // Total Shirts Needed For Event card (from Summary tab)
    if (state.result && state.result.ok) {
      wrap.appendChild(el("div", { class: "panel" }, [
        el("div", { class: "cards sponsor-cards" }, [
          el("div", { class: "sponsor-card" }, [
            el("div", { class: "sponsor-card-head", text: "Total Shirts Needed For Event" }),
            el("div", { style: "font-size:11px; color:var(--muted); margin:-6px 0 8px", text: "Paid registrations + all sponsors (excludes Walk-In T-Shirt purchases)" }),
            combinedShirtMatrix()
          ])
        ])
      ]));
    }

    // Navigation into the two full-page screens below, plus a direct-to-
    // print-preview T-Shirt Report button (no intermediate on-screen page —
    // same "straight to the browser's print dialog" pattern as the Reports
    // tab's buttons, so the printed output is just the shirt rows, no
    // banner/title text repeated on screen first).
    var orderBtn = el("button", { class: "btn primary" }, ["📧 T-Shirt Order Form"]);
    orderBtn.addEventListener("click", openTshirtOrderPage);
    var reportBtn = el("button", { class: "btn" }, ["📊 T-Shirt Report"]);
    reportBtn.addEventListener("click", printTshirtReport);
    var purchaseBtn = el("button", { class: "btn" }, ["🛒 Buy T-Shirt"]);
    purchaseBtn.addEventListener("click", openTshirtPurchasePage);
    var purchaseDetailsBtn = el("button", { class: "btn" }, ["📋 Walk-In Purchase Details"]);
    purchaseDetailsBtn.addEventListener("click", openTshirtPurchasePage);
    wrap.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "settings-actions" }, [orderBtn, reportBtn, purchaseBtn, purchaseDetailsBtn])
    ]));

    return wrap;
  }

  // ---------- Page banner helper (shared by all full-page overlays) ----------
  // Single-line banner: Back button + logo on the left, "Car Show Manager"
  // (plus an optional pageTitle sub-line naming the specific screen, e.g.
  // "T-Shirt Order Form") centered — grid layout so the title stays
  // centered on the page regardless of the left content's width.
  // printCallback is optional — when given, a "🖨 Print" button appears in
  // the banner's upper-right corner (same position on every full-page report
  // screen that has one), instead of each screen placing its own print
  // button somewhere in its body.
  function buildPageBanner(closeCallback, pageTitle, printCallback) {
    var headerLogo = $("header.app img.hdr-logo");
    var logoImg = headerLogo ? el("img", { src: headerLogo.src, style: "height:40px" }) : null;
    var leftKids = [];
    if (closeCallback) {
      var closeBtn = el("button", { class: "btn" }, ["← Back"]);
      closeBtn.addEventListener("click", closeCallback);
      leftKids.push(closeBtn);
    }
    if (logoImg) leftKids.push(logoImg);
    var centerKids = [el("h2", { text: "Car Show Manager", style: "margin: 0" })];
    if (pageTitle) centerKids.push(el("h3", { text: pageTitle, style: "margin: 4px 0 0; color: var(--muted); font-weight: 600" }));
    var rightKids = [];
    if (printCallback) {
      var printBtn = el("button", { class: "btn" }, ["🖨 Print"]);
      printBtn.addEventListener("click", printCallback);
      rightKids.push(printBtn);
    }
    return el("div", { class: "api-page-head", style: "display: grid; grid-template-columns: 1fr auto 1fr; align-items: center" }, [
      el("div", { style: "display: flex; align-items: center; gap: 10px; justify-self: start" }, leftKids),
      el("div", { style: "justify-self: center; text-align: center" }, centerKids),
      el("div", { style: "justify-self: end" }, rightKids)
    ]);
  }

  // ---------- T-Shirt Order Form (full-page screen) ----------
  function openTshirtOrderPage() {
    if (!state.emailTo) state.emailTo = state.appSettings.tshirtVendorEmail || "";
    if (!state.emailSubject) state.emailSubject = "ETCC Car Show — T-Shirt Order";
    if (!state.emailBody) state.emailBody = buildTshirtOrderEmailBody();
    state.tshirtOrderPageOpen = true;
    renderTshirtOrderPage();
  }
  function closeTshirtOrderPage() { state.tshirtOrderPageOpen = false; renderTshirtOrderPage(); }

  function renderTshirtOrderPage() {
    var host = $("#tshirtOrderHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.tshirtOrderPageOpen) return;

    var head = buildPageBanner(closeTshirtOrderPage, "T-Shirt Order Form");

    var body = el("div", { class: "api-page-inner" });

    if (!state.emailTo) state.emailTo = state.appSettings.tshirtVendorEmail || "";
    var toInput = el("input", { type: "text", value: state.emailTo || "", placeholder: "email@example.com" });
    toInput.addEventListener("input", function () { state.emailTo = toInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "To" }), toInput
    ]));
    if (!state.emailTo) {
      body.appendChild(el("div", { class: "form-error", text: "No Vendor Email set — add one in Developer > Settings > T-Shirt Vendor, or type a recipient above." }));
    }

    var subjectInput = el("input", { type: "text", value: state.emailSubject || "" });
    subjectInput.addEventListener("input", function () { state.emailSubject = subjectInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Subject" }), subjectInput
    ]));

    var ccInput = el("input", { type: "text", value: state.emailCc || "", placeholder: "email@example.com" });
    ccInput.addEventListener("input", function () { state.emailCc = ccInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "CC" }), ccInput
    ]));

    var bccInput = el("input", { type: "text", value: state.emailBcc || "", placeholder: "email@example.com" });
    bccInput.addEventListener("input", function () { state.emailBcc = bccInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "BCC" }), bccInput
    ]));

    var bodyTextarea = el("textarea", { rows: "40", style: "width:100%; font-family:monospace; font-size:13px; padding:8px; border:1px solid #ccc; resize:vertical" });
    bodyTextarea.value = state.emailBody || "";
    bodyTextarea.addEventListener("input", function () { state.emailBody = bodyTextarea.value; });
    body.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "Message Body (editable):" }),
      bodyTextarea
    ]));

    var sendBtn = el("button", { class: "btn primary" }, [state.emailSending ? "Sending…" : "Send"]);
    if (state.emailSending || !state.emailTo) sendBtn.setAttribute("disabled", "disabled");
    sendBtn.addEventListener("click", sendTshirtOrderEmail);
    var actionRow = el("div", { class: "settings-actions" }, [sendBtn]);
    if (state.emailSent) actionRow.appendChild(el("div", { class: "test-summary good", text: "Sent!" }));
    if (state.emailSendError) actionRow.appendChild(el("div", { class: "form-error", text: state.emailSendError }));
    body.appendChild(actionRow);

    var bodyWrap = el("div", { class: "api-page-body" }, [body]);
    var page = el("div", { class: "api-page" }, [head, bodyWrap]);
    host.appendChild(page);
  }

  // ---------- Reports tab ----------
  // A launcher straight into print preview for four reports — no intermediate
  // on-screen page, each button just builds its report into #printHost and
  // calls window.print() directly.
  function buildReportsView() {
    var summaryBtn = el("button", { class: "btn" }, ["📊 Car Show Summary Report"]);
    summaryBtn.addEventListener("click", printSummaryReport);
    var regBtn = el("button", { class: "btn" }, ["📋 Registration Report"]);
    regBtn.addEventListener("click", printRegistrationReport);
    var sponsorBtn = el("button", { class: "btn" }, ["🤝 Sponsor Report"]);
    sponsorBtn.addEventListener("click", printSponsorReport);
    var tshirtBtn = el("button", { class: "btn" }, ["👕 T-Shirt Report"]);
    tshirtBtn.addEventListener("click", printTshirtReport);
    var buttonCol = el("div", { class: "settings-actions", style: "flex-direction: column; align-items: flex-start" }, [summaryBtn, regBtn, sponsorBtn, tshirtBtn]);
    var row = el("div", { class: "reports-row" }, []);
    if (window.__carshowReportsBanner) {
      row.appendChild(el("img", { src: window.__carshowReportsBanner, class: "reports-banner", alt: "Reports" }));
    }
    row.appendChild(buttonCol);
    return el("div", { class: "view reports-view" }, [
      el("div", { class: "panel" }, [
        el("h3", { text: "Reports" }),
        row
      ])
    ]);
  }

  // ---------- Car Show Summary Report (print) ----------
  // Reuses buildSummaryView() verbatim (the same panels the Summary tab
  // shows on screen), cloned into #printHost, so this report can never drift
  // out of sync with what the Summary tab actually displays.
  function printSummaryReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";
    host.appendChild(buildPrintHeader("Car Show Summary Report"));
    host.appendChild(buildSummaryView());
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // ---------- Registration Report (print) ----------
  // Last Name / First Name / Reg # / Shirts only, always sorted by Last Name
  // (regardless of the Registration tab's own current sort) — scoped to that
  // tab's current search/status filters, same as its on-screen table.
  function registrationReportRows() {
    return visibleRows().slice().sort(function (a, b) {
      var aLast = String(a["Last Name"] || "").toLowerCase();
      var bLast = String(b["Last Name"] || "").toLowerCase();
      return aLast < bLast ? -1 : aLast > bLast ? 1 : 0;
    });
  }

  function printRegistrationReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";
    var thead = el("thead", {}, [el("tr", {}, [
      el("th", { text: "Last Name" }), el("th", { text: "First Name" }), el("th", { text: "Reg #" }), el("th", { text: "Shirts" })
    ])]);
    var tbody = el("tbody", {}, registrationReportRows().map(function (r) {
      return el("tr", {}, [
        el("td", { text: r["Last Name"] || "" }),
        el("td", { text: r["First Name"] || "" }),
        el("td", { text: r["Reg #"] || "" }),
        el("td", { class: "shirtsum", text: shirtSummaryText(r) })
      ]);
    }));
    host.appendChild(buildPrintHeader("Registration Report"));
    host.appendChild(el("table", { class: "grid report-table centered-report-table" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // ---------- Sponsor Report (full-page screen) ----------
  // Sponsor Name / Member Name / Sponsor Type / Contact / Phone / T-Shirt Text /
  // payment fields — a narrower column set than the Sponsors tab's own
  // SPONSOR_COLS/printSponsors(). Email/Website are intentionally omitted here.
  var SPONSOR_REPORT_COLS = [
    { key: "name", label: "Sponsor Name" },
    { key: "etccMemberName", label: "Member Name" },
    { key: "sponsorType", label: "Sponsor Type" },
    { key: "contactPerson", label: "Contact" },
    { key: "phone", label: "Phone" },
    { key: "individualSponsorshipText", label: "T-Shirt Text" },
    { key: "lastPaymentDate", label: "Payment Date" },
    { key: "lastPaymentType", label: "Payment Type" },
    { key: "lastPaymentCheckNum", label: "Check #" },
    { key: "lastPaymentAmount", label: "Paid" }
  ];
  function sponsorReportCell(s, c) {
    return el("td", { text: sponsorFieldText(s, c.key) });
  }
  // Grouped by Sponsor Type (in CONFIG.SPONSOR_TYPES' own order), then by
  // Payment Date within each type — same sortValue helper the Sponsors table's
  // own column sorting already relies on.
  function sponsorReportSorted() {
    var typeOrder = {};
    CONFIG.SPONSOR_TYPES.forEach(function (t, i) { typeOrder[t.key] = i; });
    return visibleSponsors().slice().sort(function (a, b) {
      var at = typeOrder[a.sponsorType], bt = typeOrder[b.sponsorType];
      if (at !== bt) return at - bt;
      return sponsorSortValue(a, "lastPaymentDate") - sponsorSortValue(b, "lastPaymentDate");
    });
  }
  function printSponsorReport() {
    if (!visibleSponsors().length) return;
    var host = $("#printHost");
    host.innerHTML = "";
    var thead = el("thead", {}, [el("tr", {}, SPONSOR_REPORT_COLS.map(function (c) { return el("th", { text: c.label }); }))]);
    var tbody = el("tbody", {}, sponsorReportSorted().map(function (s) {
      return el("tr", {}, SPONSOR_REPORT_COLS.map(function (c) { return sponsorReportCell(s, c); }));
    }));
    host.appendChild(buildPrintHeader("Sponsor Report"));
    host.appendChild(el("table", { class: "grid report-table" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // ---------- T-Shirt Purchases (full-page screen) ----------
  // Day-of-event walk-up sales — an officer types the purchaser's name (Cost
  // defaults from Developer > Settings > T-Shirt Vendor > "Cost to Purchase
  // at Event" but is editable per-sale) and clicks Add; the date/time is
  // stamped server-side at that moment. Every purchase made this way is
  // listed below, newest first, with a Delete for corrections.
  function openTshirtPurchasePage() {
    if (state.tshirtPurchaseCost === "") {
      state.tshirtPurchaseCost = String(state.appSettings.tshirtEventPurchaseCost || 0);
    }
    state.tshirtPurchasePageOpen = true;
    renderTshirtPurchasePage();
  }
  function closeTshirtPurchasePage() {
    state.tshirtPurchasePageOpen = false;
    renderTshirtPurchasePage();
    // The T-Shirts tab's "Total Shirts Needed For Event" matrix (rendered
    // underneath this overlay) was built before any purchases made in this
    // session — re-render it so it reflects them now that we're returning.
    renderViews();
  }

  function addTshirtPurchase() {
    var name = (state.tshirtPurchaseName || "").trim();
    var cost = Number(state.tshirtPurchaseCost);
    var paymentType = state.tshirtPurchasePaymentType || "Cash";
    var checkNum = (state.tshirtPurchaseCheckNum || "").trim();
    if (!name) {
      state.tshirtPurchaseSyncError = "Purchaser name is required.";
      renderTshirtPurchasePage();
      return;
    }
    if (isNaN(cost) || cost < 0) {
      state.tshirtPurchaseSyncError = "Cost must be a number (0 or more).";
      renderTshirtPurchasePage();
      return;
    }
    if (paymentType === "Check" && !checkNum) {
      state.tshirtPurchaseSyncError = "Check # is required for a Check payment.";
      renderTshirtPurchasePage();
      return;
    }
    upsertTshirtPurchase({
      id: "ts" + Date.now() + Math.random().toString(36).slice(2),
      purchasedAt: new Date().toISOString(),
      name: name,
      cost: cost,
      size: state.tshirtPurchaseSize || "",
      paymentType: paymentType,
      checkNum: paymentType === "Check" ? checkNum : ""
    });
    state.tshirtPurchaseName = "";
    state.tshirtPurchaseCost = String(state.appSettings.tshirtEventPurchaseCost || 0);
    state.tshirtPurchaseSize = "";
    state.tshirtPurchasePaymentType = "Cash";
    state.tshirtPurchaseCheckNum = "";
    state.tshirtPurchaseSyncError = null;
    renderTshirtPurchasePage();
  }

  function fmtPurchaseTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso || "—";
    return fmtDate(d);
  }

  function renderTshirtPurchasePage() {
    var host = $("#tshirtPurchaseHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.tshirtPurchasePageOpen) return;

    var head = buildPageBanner(closeTshirtPurchasePage, "Buy T-Shirt");

    var body = el("div", { class: "api-page-inner" });

    var nameInput = el("input", { type: "text", value: state.tshirtPurchaseName || "", placeholder: "Purchaser name" });
    nameInput.addEventListener("input", function () { state.tshirtPurchaseName = nameInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Name" }), nameInput
    ]));

    var costField = moneyInput({ value: state.tshirtPurchaseCost });
    var costInput = costField.input;
    costInput.addEventListener("input", function () { state.tshirtPurchaseCost = costInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Cost" }), costField.wrap
    ]));

    var sizeSelect = el("select", {});
    sizeSelect.appendChild(el("option", { value: "", text: "— none —" }));
    CONFIG.SPONSOR_SHIRT_SIZES.forEach(function (sz) {
      sizeSelect.appendChild(el("option", { value: sz, text: sz }));
    });
    sizeSelect.value = state.tshirtPurchaseSize || "";
    sizeSelect.addEventListener("change", function () { state.tshirtPurchaseSize = sizeSelect.value; });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "T-Shirt Size" }), sizeSelect
    ]));

    var paymentTypeSelect = el("select", {});
    ["Cash", "Check", "Credit Card"].forEach(function (t) {
      paymentTypeSelect.appendChild(el("option", { value: t, text: t }));
    });
    paymentTypeSelect.value = state.tshirtPurchasePaymentType || "Cash";
    paymentTypeSelect.addEventListener("change", function () {
      state.tshirtPurchasePaymentType = paymentTypeSelect.value;
      checkNumRow.style.display = paymentTypeSelect.value === "Check" ? "" : "none";
    });
    body.appendChild(el("div", { class: "form-row" }, [
      el("span", { class: "form-label", text: "Payment Type" }), paymentTypeSelect
    ]));

    var checkNumInput = el("input", { type: "text", placeholder: "Check #", value: state.tshirtPurchaseCheckNum || "" });
    checkNumInput.addEventListener("input", function () { state.tshirtPurchaseCheckNum = checkNumInput.value; });
    var checkNumRow = el("div", { class: "form-row", style: "display:" + (paymentTypeSelect.value === "Check" ? "" : "none") }, [
      el("span", { class: "form-label", text: "Check #" }), checkNumInput
    ]);
    body.appendChild(checkNumRow);

    var addBtn = el("button", { class: "btn primary" }, ["Add Purchase"]);
    addBtn.addEventListener("click", addTshirtPurchase);
    var actionRow = el("div", { class: "settings-actions" }, [addBtn]);
    if (state.tshirtPurchaseSyncError) actionRow.appendChild(el("div", { class: "form-error", text: state.tshirtPurchaseSyncError }));
    body.appendChild(actionRow);

    var purchases = state.tshirtPurchases.slice().sort(function (a, b) {
      return String(b.purchasedAt || "").localeCompare(String(a.purchasedAt || ""));
    });

    if (!purchases.length) {
      body.appendChild(el("div", { class: "hint", style: "text-align:center; padding:20px" }, ["No purchases recorded yet."]));
    } else {
      var rows = purchases.map(function (p) {
        var delBtn = el("button", { class: "btn", style: "padding:2px 8px; font-size:12px" }, ["Delete"]);
        delBtn.addEventListener("click", function () { removeTshirtPurchase(p.id); });
        return el("tr", {}, [
          el("td", { text: fmtPurchaseTime(p.purchasedAt) }),
          el("td", { text: p.name || "—" }),
          el("td", { text: fmtMoney(p.cost) }),
          el("td", { text: p.size || "—" }),
          el("td", { text: p.paymentType || "—" }),
          el("td", { text: p.paymentType === "Check" ? (p.checkNum || "—") : "" }),
          el("td", {}, [delBtn])
        ]);
      });
      var total = purchases.reduce(function (sum, p) { return sum + (Number(p.cost) || 0); }, 0);
      var totalRow = el("tr", {}, [
        el("td", { colspan: "2", style: "text-align:right; font-weight:600", text: purchases.length + " purchase" + (purchases.length === 1 ? "" : "s") + " — Total" }),
        el("td", { style: "font-weight:600", text: fmtMoney(total) }),
        el("td", {}), el("td", {}), el("td", {}), el("td", {})
      ]);
      body.appendChild(el("table", { class: "matrix" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "Date/Time" }),
          el("th", { text: "Name" }),
          el("th", { text: "Cost" }),
          el("th", { text: "Size" }),
          el("th", { text: "Payment Type" }),
          el("th", { text: "Check #" }),
          el("th", { text: "" })
        ])]),
        el("tbody", {}, rows),
        el("tfoot", {}, [totalRow])
      ]));
    }

    var bodyWrap = el("div", { class: "api-page-body" }, [body]);
    var page = el("div", { class: "api-page" }, [head, bodyWrap]);
    host.appendChild(page);
  }

  function init() {
    document.body.appendChild(el("div", { id: "detailHost" }));
    document.body.appendChild(el("div", { id: "printHost" }));
    document.body.appendChild(el("div", { id: "settingsHost" }));
    document.body.appendChild(el("div", { id: "changelogHost" }));
    document.body.appendChild(el("div", { id: "apiHost" }));
    document.body.appendChild(el("div", { id: "tshirtOrderHost" }));
    document.body.appendChild(el("div", { id: "tshirtPurchaseHost" }));
    document.body.appendChild(el("div", { id: "sponsorFormHost" }));
    document.body.appendChild(el("div", { id: "paymentHost" }));
    document.body.appendChild(el("div", { id: "addRegHost" }));
    document.body.appendChild(el("div", { id: "confirmHost" }));
    document.body.appendChild(el("div", { id: "testsHost" }));
    document.body.appendChild(el("div", { id: "developerLoginHost" }));
    // window.__carshowSite is set (by index.php, before this script runs) —
    // see the declaration comment near SITE_CONFIG above. Read it here, not
    // at module-load time, since init() is what's guaranteed to run after
    // every inline script in the document.
    SITE_CONFIG = window.__carshowSite || {};
    // member-sponsor-form.php redirects here with #sponsors after a successful
    // submission (opened in its own tab from the Sponsors tab's "+ Add
    // Sponsor" button) — land on a fresh Sponsors tab, already showing the
    // new submission, instead of the default Summary tab. Also skip the
    // splash screen in this case — it's the same tab the officer was
    // already using, not a fresh app load, so there's nothing to welcome
    // them back to.
    if (location.hash === "#sponsors") { state.tab = "sponsors"; state.splashOpen = false; }
    buildHeaderMenu();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.settingsOpen) { closeSettings(); return; }
      if (e.key === "Escape" && state.testsPageOpen) { closeTestsPage(); return; }
      if (e.key === "Escape" && state.developerLoginOpen) { closeDeveloperLogin(); return; }
      if (e.key === "Escape" && state.changelogOpen) { closeChangelog(); return; }
      if (e.key === "Escape" && state.apiPageOpen) { closeApiPage(); return; }
      if (e.key === "Escape" && state.tshirtOrderPageOpen) { closeTshirtOrderPage(); return; }
      if (e.key === "Escape" && state.tshirtPurchasePageOpen) { closeTshirtPurchasePage(); return; }
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
  var API = window.__carshow = {
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
    // Called by index.php's boot script, BEFORE ingestRows() (which triggers
    // syncSponsorsFromRegistrations()), with the set of CSV-auto-synced
    // sponsor ids previously deleted from the Sponsors tab.
    ingestDeletedSponsors: function (ids) {
      state.deletedSponsorIds = {};
      (Array.isArray(ids) ? ids : []).forEach(function (id) { state.deletedSponsorIds[id] = true; });
    },
    // Called by index.php's boot script with the Walk-In registrations list
    // read fresh from the server on this page load.
    ingestWalkins: function (list) {
      state.walkins = Array.isArray(list) ? list : [];
      renderViews();
    },
    // Called by index.php's boot script with the day-of-event t-shirt
    // purchases list read fresh from the server on this page load.
    ingestTshirtPurchases: function (list) {
      state.tshirtPurchases = Array.isArray(list) ? list : [];
      renderTshirtPurchasePage();
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
