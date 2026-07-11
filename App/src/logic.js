/* =============================================================================
 * logic.js — pure data transform. No DOM. Runs in the browser AND in Node
 * (for the test harness). Ports the VBA pipeline (CSpreadsheet /
 * CRegistrationSheet / CActivity / CItem / CSummarySheet).
 * ========================================================================== */
(function (root) {
  "use strict";

  var CONFIG = root.CarShowConfig ||
    (typeof require !== "undefined" ? require("./config.js") : null);

  // ---- small helpers -------------------------------------------------------
  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ""; }
  function toInt(v) { var n = parseInt(String(v).replace(/[^0-9\-]/g, ""), 10); return isNaN(n) ? 0 : n; }
  function toNum(v) { if (isBlank(v)) return 0; var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }

  function formatPhone(phoneTxt) {
    if (isBlank(phoneTxt)) return "";
    var digits = String(phoneTxt).replace(/\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
    if (digits.length === 10) {
      return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
    }
    return String(phoneTxt); // leave untouched if not a 10-digit number
  }

  // Parse "6/30/2026 12:47:00 PM" (or a plain Date) to a millisecond key for
  // matching registrations to their activity rows. Returns NaN if unparseable.
  function dtKey(v) {
    if (v instanceof Date) return v.getTime();
    if (isBlank(v)) return NaN;
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
    if (m) {
      var mo = +m[1], da = +m[2], yr = +m[3], hr = +m[4], mi = +m[5], se = +(m[6] || 0);
      var ap = m[7] ? m[7].toUpperCase() : "";
      if (ap === "PM" && hr < 12) hr += 12;
      if (ap === "AM" && hr === 12) hr = 0;
      return new Date(yr, mo - 1, da, hr, mi, se).getTime();
    }
    var t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  }

  function genFromYear(year) {
    if (!year || year <= 0) return "";
    for (var i = 0; i < CONFIG.corvetteGenerations.length; i++) {
      var g = CONFIG.corvetteGenerations[i];
      if (year >= g.from && year <= g.to) return g.gen;
    }
    return "";
  }

  function hasColumn(rows, name) {
    if (!rows.length) return false;
    return Object.prototype.hasOwnProperty.call(rows[0], name);
  }

  // "First [and Spouse First] Last" — e.g. "John Smith" or "John and Jane
  // Smith". Neither "Spouse First Name" nor "Ind. Spon. Text"
  // have a ClubExpress CSV source; both are blank until this default fires
  // or an officer hand-fills them via the detail modal.
  function sponsorshipDefaultText(rec) {
    var first = String(rec["First Name"] || "").trim();
    var spouse = String(rec["Spouse First Name"] || "").trim();
    var last = String(rec["Last Name"] || "").trim();
    return (first + (spouse ? " and " + spouse : "") + " " + last).trim();
  }
  // Insert-only, same rationale as the Sponsors-tab Reg Date backfill: fires
  // only while "Ind. Spon. Text" is still blank, so it never
  // overwrites an officer's hand-edit (including a deliberate blank — if
  // Individual Sponsorship stays > 0, the next thing that touches this
  // record re-defaults it, matching the literal rule requested: "if ...
  // blank, default to ..."). Called from generate() (fresh CSV rows),
  // buildManualRegistration() (fresh Walk-In rows), and app.js's
  // applyRecordPatch() (every edit/override re-application), so the default
  // reliably (re)applies wherever a record's fields can change.
  function applySponsorshipTextDefault(rec) {
    if (toNum(rec["Individual Sponsorship"]) > 0 && isBlank(rec["Ind. Spon. Text"])) {
      rec["Ind. Spon. Text"] = sponsorshipDefaultText(rec);
    }
    return rec;
  }

  // Shared by generate() and buildManualRegistration(): shirt bucket key ->
  // its final column header (e.g. "MensFreeLG" -> "Men's Free LG").
  function bucketCol(key, C) {
    C = C || CONFIG;
    for (var i = 0; i < C.SHIRT_BUCKETS.length; i++) if (C.SHIRT_BUCKETS[i].key === key) return C.SHIRT_BUCKETS[i].col;
    return key;
  }

  // Aggregate attendees/funds/sponsorship/shirts/generations/clubs from a list
  // of already-built registration records (the same shape as generate()'s
  // `registrations` output). Kept independent of generate()'s CSV/activity
  // matching so the app can re-run it against just the currently filtered/
  // visible subset of records (search, status) for a live Summary
  // tab, not only once against the full dataset.
  function summarizeRecords(records, C) {
    C = C || CONFIG;
    var carShow = {}; // gen -> {atEvent, inCarShow}
    C.corvetteGenerations.forEach(function (g) { carShow[g.gen] = { atEvent: 0, inCarShow: 0 }; });
    var clubTally = {}; // name -> attendees (insertion order preserved)
    var shirtTotals = {};
    C.SHIRT_BUCKETS.forEach(function (b) { shirtTotals[b.key] = 0; });
    var totalAttendees = 0, totalFunds = 0, totalSponsorship = 0;

    records.forEach(function (rec) {
      var attendee = toInt(rec["#"]) || 0;
      totalAttendees += attendee;
      totalFunds += toNum(rec["Total Fee"]);
      totalSponsorship += toNum(rec[C.sponsorshipActivityTitle]);
      C.SHIRT_BUCKETS.forEach(function (b) { shirtTotals[b.key] += Number(rec[b.col]) || 0; });

      var gen = rec["Gen"];
      if (gen && carShow[gen]) {
        carShow[gen].atEvent += 1;
        if (String(rec["In Car Show?"]).trim().toLowerCase() === "yes") carShow[gen].inCarShow += 1;
      }

      // blank Club Name -> "Unknown" with 0 attendees, matching the VBA
      var club = rec["Club Name"];
      club = isBlank(club) ? "Unknown" : String(club).trim();
      clubTally[club] = (clubTally[club] || 0) + attendee;
    });

    var clubs = Object.keys(clubTally).map(function (k) {
      return { name: k, attendees: clubTally[k] };
    }).sort(function (a, b) { return b.attendees - a.attendees || (a.name < b.name ? -1 : 1); });

    var gens = C.corvetteGenerations.map(function (g) {
      return { gen: g.gen, from: g.from, to: g.to,
               atEvent: carShow[g.gen].atEvent, inCarShow: carShow[g.gen].inCarShow };
    });

    return {
      attendees: totalAttendees,
      registrations: records.length,
      funds: totalFunds,
      sponsorship: totalSponsorship,
      judges: 0, // not tracked from CSV data in this port (carried over from the VBA field)
      shirtTotals: shirtTotals,
      gens: gens,
      clubs: clubs
    };
  }

  // ---- main ----------------------------------------------------------------
  // regRows / actRows: arrays of objects keyed by CSV header.
  // opts: { regFileName, actFileName, generatedAt }
  function generate(regRows, actRows, opts) {
    opts = opts || {};
    var C = CONFIG;
    var messages = [];

    regRows = regRows || [];
    actRows = actRows || [];

    // --- validation -------------------------------------------------------
    if (!regRows.length) {
      return failure("Registration file is empty.", opts, regRows, actRows);
    }
    if (!hasColumn(regRows, C.registrationValidColumn)) {
      return failure("File is not a registration export — missing column '" +
        C.registrationValidColumn + "'.", opts, regRows, actRows);
    }
    if (actRows.length && !hasColumn(actRows, C.activityValidColumn)) {
      return failure("File is not an activity export — missing column '" +
        C.activityValidColumn + "'.", opts, regRows, actRows);
    }

    // --- final column layout ---------------------------------------------
    var shirtCols = C.SHIRT_BUCKETS.map(function (b) { return b.col; });
    var columns = C.baseColumnOrder.concat(shirtCols);

    // --- index activities by registration datetime -----------------------
    var actByDt = {};
    actRows.forEach(function (a) {
      var k = dtKey(a[C.dateTimeColumn]);
      if (isNaN(k)) return;
      (actByDt[k] || (actByDt[k] = [])).push(a);
    });

    // --- per-registration processing -------------------------------------
    // optionally drop cancelled rows
    var working = regRows.filter(function (r) {
      if (!C.showCancelled && String(r.Status).trim() === "Cancelled") return false;
      return true;
    });

    var records = working.map(function (r) {
      var rec = buildRecord(r, columns, shirtCols);
      rec["Reg Type"] = C.REG_TYPE.PRE_REGISTERED;

      var freeSize = r[C.freeTShirtSizeColumn];
      var matches = actByDt[dtKey(r[C.dateTimeColumn])] || [];
      var attendee = 0;

      matches.forEach(function (a) {
        var title = a["Activity Title"];
        if (title === C.registrationActivityTitle) {
          attendee = 1;                       // one attendee per car-show registration
          var fb = C.freeSizeMap[freeSize];    // free shirt from the registration's size
          if (fb) rec[bucketCol(fb)] = (rec[bucketCol(fb)] || 0) + 1;
        } else if (title === C.sponsorshipActivityTitle) {
          // Bonus sponsor shirt — sized from the activity's own column, not the
          // registrant's FreeTShirtSize; does not add an attendee or use fee/unitCost.
          var sponsorShirtRaw = a[C.sponsorFreeShirtColumn];
          var sb = C.freeSizeMap[sponsorShirtRaw];
          if (sb) rec[bucketCol(sb)] = (rec[bucketCol(sb)] || 0) + 1;
          else messages.push("Invalid sponsor shirt size '" + sponsorShirtRaw + "'");
          rec[C.sponsorshipActivityTitle] = (toNum(rec[C.sponsorshipActivityTitle]) || 0) + toNum(a["Activity Fee"]);
          // Not a real CSV column — the app reads this to auto-add a Sponsors-tab
          // entry for this registrant without having to guess their shirt size
          // back out of the (possibly ambiguous, if it matches their own free
          // shirt's size) aggregated shirt buckets above.
          rec._sponsorShirtSize = sb ? sponsorShirtRaw : "";
          var sponsorName = a[C.sponsorNameColumn];
          if (!isBlank(sponsorName)) rec["Ind. Spon. Text"] = sponsorName;
        } else {
          var bucket = C.activityTitleToBucket[title];
          if (bucket) {
            var qty = Math.round(toNum(a["Activity Fee"]) / C.unitCost) || 0;
            if (qty <= 0) qty = 1;
            rec[bucketCol(bucket)] = (rec[bucketCol(bucket)] || 0) + qty;
          } else {
            messages.push("Invalid activity title '" + title + "'");
          }
        }
      });

      // generation from year
      var year = toInt(r[C.corvetteYearColumn] || r["CorvetteYear"]);
      var gen = genFromYear(year);
      rec["Gen"] = gen;
      if (year > 0 && !gen) {
        messages.push("Invalid Corvette year '" + year + "' for " +
          (r["Last Name"] || "") + ", " + (r["First Name"] || ""));
      }

      rec["#"] = attendee;
      applySponsorshipTextDefault(rec);
      return rec;
    });

    var registrationsCount = records.length;

    // --- assign non-member numbers (pre-sort, top-to-bottom) --------------
    var nextNum = C.firstNonMember;
    if (nextNum > 0) {
      records.forEach(function (rec) {
        if (toInt(rec["Reg #"]) === 0) {
          rec["Reg #"] = nextNum;
          nextNum += 1;
        }
      });
    }
    var nextAvailableMemberNum = nextNum;

    // --- format phones ----------------------------------------------------
    records.forEach(function (rec) { rec["Phone"] = formatPhone(rec["Phone"]); });

    // --- sort -------------------------------------------------------------
    var sortCol = C.sortBy;
    records.sort(function (a, b) {
      var av = String(a[sortCol] == null ? "" : a[sortCol]).toLowerCase();
      var bv = String(b[sortCol] == null ? "" : b[sortCol]).toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    });

    // --- summary ------------------------------------------------------------
    // Computed from the final `records` rather than tracked inline above, so
    // the exact same aggregation can be reused against just a filtered/visible
    // subset of records (see summarizeRecords below).
    var summary = summarizeRecords(records, C);
    summary.nextMemberNumber = nextAvailableMemberNum; // capacity planning figure, not tied to any filtering

    var errorCount = messages.length;
    var statusMessage = errorCount === 0
      ? "Successfully created " + registrationsCount + " registrations"
      : "Registrations created with " + errorCount + " errors";

    return {
      ok: true,
      columns: columns,
      shirtColumns: shirtCols,
      registrations: records,
      messages: messages,
      summary: summary,
      meta: {
        title: C.title,
        regFileName: opts.regFileName || "",
        actFileName: opts.actFileName || "",
        regRows: regRows.length,
        actRows: actRows.length,
        generatedAt: opts.generatedAt || new Date(),
        statusMessage: statusMessage,
        errorCount: errorCount
      }
    };
  }

  function buildRecord(srcRow, columns, shirtCols) {
    // Start from a blank record, then copy renamed source values in.
    var rec = blankRecord(columns, shirtCols);
    var C = CONFIG;
    // For each source column, map to its (renamed) final name if that name is a column.
    Object.keys(srcRow).forEach(function (k) {
      if (C.deleteColumns.indexOf(k) !== -1) return;
      var finalName = C.renameMap[k] || k;
      if (columns.indexOf(finalName) !== -1) {
        rec[finalName] = srcRow[k];
      }
    });
    // Numeric coercions for display/formatting.
    if (!isBlank(rec["Total Fee"])) rec["Total Fee"] = toNum(rec["Total Fee"]);
    if (!isBlank(rec["Reg #"])) rec["Reg #"] = toInt(rec["Reg #"]);
    return rec;
  }

  function blankRecord(columns, shirtCols) {
    var rec = {};
    columns.forEach(function (c) { rec[c] = ""; });
    shirtCols.forEach(function (c) { rec[c] = 0; });
    rec["Reg #"] = "";
    // Not a baseColumnOrder column (removed from the Registration
    // tab/detail modal/Excel export) but still computed on every record —
    // initialize it here so it's reliably "" rather than undefined until
    // applySponsorshipTextDefault() sets it, same guarantee every other
    // field already has.
    rec["Ind. Spon. Text"] = "";
    return rec;
  }

  // Builds one registration record for a manually-entered Walk-In (Member or
  // Nonmember) from the "+ Add Registration" form — same record shape
  // generate() produces (baseColumnOrder + shirt bucket columns), so it
  // flows through the app's existing search/sort/summary/print/detail-modal
  // code identically to a CSV-derived row. Kept in this pure module (not
  // app.js) so it stays independently testable, same rationale as
  // summarizeRecords. fields.regDate is expected pre-formatted (a display
  // string, not a Date) since this module has no DOM/date-formatting
  // knowledge of its own — app.js's fmtDate() owns that.
  function buildManualRegistration(fields, C) {
    C = C || CONFIG;
    fields = fields || {};
    var shirtCols = C.SHIRT_BUCKETS.map(function (b) { return b.col; });
    var columns = C.baseColumnOrder.concat(shirtCols);
    var rec = blankRecord(columns, shirtCols);

    rec["Reg Type"] = fields.regType;
    rec["Last Name"] = fields.lastName || "";
    rec["First Name"] = fields.firstName || "";
    rec["Reg #"] = fields.memberNumber ? toInt(fields.memberNumber) : (toInt(fields.nextAvailableMemberNumber) || C.firstNonMember);
    rec["Reg Date"] = fields.regDate || "";
    rec["#"] = 1; // a walk-in is, by definition, physically at the event
    rec["Club Name"] = fields.clubName || "";
    rec["Phone"] = formatPhone(fields.phone || "");
    rec["Email"] = fields.email || "";
    rec["Address"] = fields.address || "";
    rec["City"] = fields.city || "";
    rec["State"] = fields.state || "";
    rec["Zip"] = fields.zip || "";
    rec["Total Fee"] = toNum(fields.totalFee);
    rec["Status"] = fields.status || "Paid";
    var year = toInt(fields.year);
    rec["Year"] = year || "";
    rec["Model"] = fields.model || "";
    rec["Gen"] = genFromYear(year);
    rec["In Car Show?"] = fields.inCarShow || "";
    rec["Color"] = fields.color || "";
    rec["FreeTShirtSize"] = fields.freeTShirtSize || "";
    var bucketKey = C.freeSizeMap[fields.freeTShirtSize];
    if (bucketKey) rec[bucketCol(bucketKey, C)] = 1;

    applySponsorshipTextDefault(rec); // no-op today (this form has no Individual Sponsorship field yet), kept for consistency/future-proofing
    rec.id = fields.id || null; // caller (app.js) assigns a stable id on first save
    return rec;
  }

  function failure(msg, opts, regRows, actRows) {
    return {
      ok: false,
      columns: [], shirtColumns: [], registrations: [],
      messages: [msg],
      summary: null,
      meta: {
        title: CONFIG.title,
        regFileName: opts.regFileName || "", actFileName: opts.actFileName || "",
        regRows: (regRows || []).length, actRows: (actRows || []).length,
        generatedAt: opts.generatedAt || new Date(),
        statusMessage: msg, errorCount: 1
      }
    };
  }

  var API = { generate: generate, summarizeRecords: summarizeRecords, formatPhone: formatPhone, genFromYear: genFromYear, dtKey: dtKey, buildManualRegistration: buildManualRegistration, toInt: toInt, toNum: toNum, applySponsorshipTextDefault: applySponsorshipTextDefault };
  root.CarShowLogic = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
