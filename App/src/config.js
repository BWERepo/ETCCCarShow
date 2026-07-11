/* =============================================================================
 * CONFIG — ported verbatim from the workbook's Configuration sheet.
 * Edit THIS to adapt the tool to a different event. No code changes needed.
 * (This is the data that the old VBA read from named ranges + config tables.)
 * ========================================================================== */
(function (root) {
  "use strict";

  // The 6 shirt sizes, in display order, with the size-suffix used in bucket keys.
  var SIZES = [
    { key: "SM",   label: "Small" },
    { key: "MED",  label: "Medium" },
    { key: "LG",   label: "Large" },
    { key: "XLG",  label: "Extra Large" },
    { key: "2XLG", label: "2XL" },
    { key: "3XLG", label: "3XL" }
  ];

  // The 4 shirt groups (matrix columns on the summary).
  var GROUPS = [
    { key: "MensFree",   gender: "Men's",   type: "Free", label: "Men's Free" },
    { key: "MensXtra",   gender: "Men's",   type: "Xtra", label: "Men's Xtra" },
    { key: "WomensFree", gender: "Women's", type: "Free", label: "Women's Free" },
    { key: "WomensXtra", gender: "Women's", type: "Xtra", label: "Women's Xtra" }
  ];

  // Build the 24 shirt buckets: { key, col, group, size }.
  // key  e.g. "MensFreeLG"  |  col (registration column header) e.g. "Men's Free LG"
  var SHIRT_BUCKETS = [];
  GROUPS.forEach(function (g) {
    SIZES.forEach(function (s) {
      SHIRT_BUCKETS.push({
        key: g.key + s.key,
        col: g.label + " " + s.key,
        groupKey: g.key,
        sizeKey: s.key
      });
    });
  });

  // Sponsors tab: a sponsor picks one shirt (no Free/Xtra distinction like
  // registrants), so build the 12 "Men's/Women's Small..3XL" strings from the
  // same SIZES table used everywhere else, plus a reverse lookup from that
  // string back to { gender, sizeKey } for tallying the Summary tab's
  // per-sponsor-type shirt-size cards.
  var SPONSOR_GENDERS = ["Men's", "Women's"];
  var SPONSOR_SHIRT_SIZES = [];
  var SPONSOR_SIZE_INDEX = {};
  SPONSOR_GENDERS.forEach(function (g) {
    SIZES.forEach(function (s) {
      var label = g + " " + s.label;
      SPONSOR_SHIRT_SIZES.push(label);
      SPONSOR_SIZE_INDEX[label] = { gender: g, sizeKey: s.key };
    });
  });

  var CONFIG = {
    // --- Variables (Configuration sheet: Variables table) ---
    title: "2026 Car Show Registration List",
    firstNonMember: 8001,

    // --- Reg Type column values (first column in the Registration table) ---
    // Every row built from the CSVs is "Pre-Registered". WALKIN_MEMBER/
    // WALKIN_NONMEMBER are assigned only by the Registration tab's
    // "+ Add Registration" form (see app.js's buildManualRegistration call) —
    // an officer manually entering someone who shows up without having
    // pre-registered online.
    REG_TYPE: {
      PRE_REGISTERED: "Pre-Registered",
      WALKIN_MEMBER: "Walk-In Member",
      WALKIN_NONMEMBER: "Walk-In Nonmember"
    },
    showCancelled: true,          // keep Cancelled rows
    sortBy: "Last Name",
    dateTimeColumn: "Date/Time",  // column used to match registrations <-> activities
    unitCost: 25,                 // shirt Item unit cost; qty = Activity Fee / unitCost

    // --- Validation (Event Specific Configuration) ---
    registrationValidColumn: "Companion Count",
    activityValidColumn: "Activity Sequence Number",

    // --- Event-specific question -> canonical column names ---
    freeTShirtSizeColumn: "FreeTShirtSize",
    corvetteYearColumn: "Year",       // after rename
    carJudgedColumn: "In Car Show?",  // after rename
    clubNameColumn: "Club Name",      // after rename
    totalFeeColumn: "Total Fee",

    // The activity title that means "attended + gets the free shirt".
    registrationActivityTitle: "Car Show Registration",

    // Individual Sponsorship: a $100 add-on activity (confirmed 2026-07-07) that
    // grants ONE bonus free shirt on top of whatever the registrant's own Car Show
    // Registration already gave them. Its size comes from a column on the ACTIVITY
    // row itself (CSFreeSponsorShirt), not the registration's FreeTShirtSize —
    // handled separately from both registrationActivityTitle (no extra attendee)
    // and activityTitleToBucket (no fee/unitCost quantity math; always exactly 1).
    sponsorshipActivityTitle: "Individual Sponsorship",
    sponsorFreeShirtColumn: "CSFreeSponsorShirt",
    sponsorNameColumn: "CSSponsorName",

    // --- Column Rename Table (Old -> New) ---
    renameMap: {
      "Member Number": "Reg Number",
      "CorvetteClubName": "Club Name",
      "Postal Code": "Zip",
      "CorvetteYear": "Year",
      "CorvetteColor": "Color",
      "CorvetteModel": "Model",
      "CarJudged": "In Car Show?",
      "Companion Count": "#",
      "Date/Time": "Reg Date",
      "Address 1": "Address"
    },

    // --- Delete Column Table ---
    deleteColumns: [
      "Sequence Number", "Primary Member?", "CorvetteClubName Comments",
      "CorvetteYear Comments", "CorvetteModel Comments", "CorvetteColor Comments",
      "Country", "Company", "Work Title", "Title", "Middle Initial", "Nickname",
      "Cell Phone", "Registrant Type", "Address 2", "Member?", "CarJudged Comments"
    ],

    // --- Final column order (matches today's RegistrationSheet) ---
    // Shirt columns are appended programmatically (all 24, in SHIRT_BUCKETS order).
    // "Spouse First Name" and "Individual Sponsorship Text" have no CSV source
    // (ClubExpress's export has neither) — they start blank on every fresh
    // CSV row and are filled in either automatically (see
    // applySponsorshipTextDefault() in logic.js) or by hand via the detail
    // modal's Edit mode. See PROJECT_STATUS.md for why.
    baseColumnOrder: [
      "Reg Number", "Reg Type", "Last Name", "First Name", "Spouse First Name", "Reg Date",
      "#", "Club Name", "Phone", "Email", "Address", "City", "State",
      "Zip", "Total Fee", "Individual Sponsorship", "Individual Sponsorship Text", "Status", "Year", "Model", "Gen", "In Car Show?",
      "Color", "FreeTShirtSize", "FreeTShirtSize Comments"
    ],

    // --- Free shirt: FreeTShirtSize value -> bucket key ---
    // (from CActivity.ProcessCarShowRegistration Select Case)
    freeSizeMap: {
      "Men's Small": "MensFreeSM",
      "Men's Medium": "MensFreeMED",
      "Men's Large": "MensFreeLG",
      "Men's Extra Large": "MensFreeXLG",
      "Men's 2XL": "MensFree2XLG",
      "Men's 3XL": "MensFree3XLG",
      "Women's Small": "WomensFreeSM",
      "Women's Medium": "WomensFreeMED",
      "Women's Large": "WomensFreeLG",
      "Women's Extra Large": "WomensFreeXLG",
      "Women's 2XL": "WomensFree2XLG",
      "Women's 3XL": "WomensFree3XLG"
    },

    // --- Shirt Item activity title -> bucket key ---
    // Ported from the Activity Item Table (title -> heading) combined with the
    // gender in the title. This REPLACES the VBA's duplicated hardcoded Select
    // Case lists, so config and code can never drift (the cause of the recent
    // "Extra" vs "Additional" bug). To support a renamed shirt title, edit here.
    activityTitleToBucket: {
      // Free shirts sold as their own activity (not used by this event, but kept
      // for completeness / other events that do it that way):
      "Men's Free T-Shirt - Small": "MensFreeSM",
      "Men's Free T-Shirt - Medium": "MensFreeMED",
      "Men's Free T-Shirt - Large": "MensFreeLG",
      "Men's Free T-Shirt - XL": "MensFreeXLG",
      "Men's Free T-Shirt - 2XL": "MensFree2XLG",
      "Men's Free T-Shirt - 3XL": "MensFree3XLG",
      "Women's Free T-Shirt - Small": "WomensFreeSM",
      "Women's Free T-Shirt - Medium": "WomensFreeMED",
      "Women's Free T-Shirt - Large": "WomensFreeLG",
      "Women's Free T-Shirt - XL": "WomensFreeXLG",
      "Women's Free T-Shirt - 2XL": "WomensFree2XLG",
      "Women's Free T-Shirt - 3XL": "WomensFree3XLG",
      // Additional (paid) shirts -> Xtra buckets:
      "Men's Additional T-Shirt - Small": "MensXtraSM",
      "Men's Additional T-Shirt - Medium": "MensXtraMED",
      "Men's Additional T-Shirt - Large": "MensXtraLG",
      "Men's Additional T-Shirt - XL": "MensXtraXLG",
      "Men's Additional T-Shirt - 2XL": "MensXtra2XLG",
      "Men's Additional T-Shirt - 3XL": "MensXtra3XLG",
      "Women's Additional T-Shirt - Small": "WomensXtraSM",
      "Women's Additional T-Shirt - Medium": "WomensXtraMED",
      "Women's Additional T-Shirt - Large": "WomensXtraLG",
      "Women's Additional T-Shirt - XL": "WomensXtraXLG",
      "Women's Additional T-Shirt - 2XL": "WomensXtra2XLG",
      "Women's Additional T-Shirt - 3XL": "WomensXtra3XLG"
    },

    // --- Corvette Generation Table (year -> generation) ---
    corvetteGenerations: [
      { gen: "C1", from: 1953, to: 1962 },
      { gen: "C2", from: 1963, to: 1967 },
      { gen: "C3", from: 1968, to: 1982 },
      { gen: "C4", from: 1984, to: 1996 },
      { gen: "C5", from: 1997, to: 2004 },
      { gen: "C6", from: 2005, to: 2013 },
      { gen: "C7", from: 2014, to: 2019 },
      { gen: "C8", from: 2020, to: 2030 }
    ],

    // Derived tables (exposed for UI/logic):
    SIZES: SIZES,
    GROUPS: GROUPS,
    SHIRT_BUCKETS: SHIRT_BUCKETS,

    // --- Sponsors tab (manually entered, not derived from the CSV exports) ---
    SPONSOR_TYPES: [
      { key: "premier", label: "Premier ($250)", fee: 250 },
      { key: "corporate", label: "Corporate ($100)", fee: 100 },
      { key: "individual", label: "Individual ($100)", fee: 100 }
    ],
    SPONSOR_SHIRT_SIZES: SPONSOR_SHIRT_SIZES,
    SPONSOR_SIZE_INDEX: SPONSOR_SIZE_INDEX
  };

  root.CarShowConfig = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})(typeof globalThis !== "undefined" ? globalThis : this);
