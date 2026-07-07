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
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

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
    var carShow = {}; // gen -> {atEvent, inCarShow}
    C.corvetteGenerations.forEach(function (g) { carShow[g.gen] = { atEvent: 0, inCarShow: 0 }; });
    var clubTally = {}; // name -> attendees (insertion order preserved)
    var shirtTotals = {};
    C.SHIRT_BUCKETS.forEach(function (b) { shirtTotals[b.key] = 0; });

    var totalAttendees = 0, totalFunds = 0, totalJudges = 0;

    // optionally drop cancelled rows
    var working = regRows.filter(function (r) {
      if (!C.showCancelled && String(r.Status).trim() === "Cancelled") return false;
      return true;
    });

    var records = working.map(function (r) {
      var rec = buildRecord(r, columns, shirtCols);
      rec._isWalkIn = false;

      var freeSize = r[C.freeTShirtSizeColumn];
      var matches = actByDt[dtKey(r[C.dateTimeColumn])] || [];
      var attendee = 0;

      matches.forEach(function (a) {
        var title = a["Activity Title"];
        if (title === C.registrationActivityTitle) {
          attendee = 1;                       // one attendee per car-show registration
          rec["Reg Type"] = title;
          var fb = C.freeSizeMap[freeSize];    // free shirt from the registration's size
          if (fb) { rec[bucketCol(fb)] = (rec[bucketCol(fb)] || 0) + 1; shirtTotals[fb] += 1; }
        } else if (title === C.sponsorshipActivityTitle) {
          // Bonus sponsor shirt — sized from the activity's own column, not the
          // registrant's FreeTShirtSize; does not add an attendee or use fee/unitCost.
          var sb = C.freeSizeMap[a[C.sponsorFreeShirtColumn]];
          if (sb) { rec[bucketCol(sb)] = (rec[bucketCol(sb)] || 0) + 1; shirtTotals[sb] += 1; }
          else messages.push("Invalid sponsor shirt size '" + a[C.sponsorFreeShirtColumn] + "'");
        } else {
          var bucket = C.activityTitleToBucket[title];
          if (bucket) {
            var qty = Math.round(toNum(a["Activity Fee"]) / C.unitCost) || 0;
            if (qty <= 0) qty = 1;
            rec[bucketCol(bucket)] = (rec[bucketCol(bucket)] || 0) + qty;
            shirtTotals[bucket] += qty;
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

      // attendee / funds / judges
      rec["#"] = attendee;
      totalAttendees += attendee;
      totalFunds += toNum(r[C.totalFeeColumn]);

      // car-show generation matrix
      var judged = String(r["CarJudged"]).trim().toLowerCase() === "yes";
      if (gen) {
        carShow[gen].atEvent += 1;
        if (judged) carShow[gen].inCarShow += 1;
      }

      // clubs
      var club = r["CorvetteClubName"];
      club = isBlank(club) ? "Unknown" : String(club).trim();
      clubTally[club] = (clubTally[club] || 0) + attendee;

      return rec;
    });

    // --- walk-in rows -----------------------------------------------------
    for (var w = 1; w <= C.walkInCount; w++) {
      var wr = blankRecord(columns, shirtCols);
      wr["Last Name"] = "z-> Walk-In " + pad2(w);
      wr["#"] = 0;
      wr._isWalkIn = true;
      records.push(wr);
      // walk-ins add a blank club (Unknown) with 0 attendees, matching the VBA
      clubTally["Unknown"] = (clubTally["Unknown"] || 0);
    }

    var registrationsCount = records.length; // real + walk-ins (matches VBA)

    // --- assign non-member numbers (pre-sort, top-to-bottom) --------------
    var nextNum = C.firstNonMember;
    if (nextNum > 0) {
      records.forEach(function (rec) {
        if (toInt(rec["Member Number"]) === 0) {
          rec["Member Number"] = nextNum;
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

    // --- summary ----------------------------------------------------------
    var clubs = Object.keys(clubTally).map(function (k) {
      return { name: k, attendees: clubTally[k] };
    }).sort(function (a, b) { return b.attendees - a.attendees || (a.name < b.name ? -1 : 1); });

    var gens = C.corvetteGenerations.map(function (g) {
      return { gen: g.gen, from: g.from, to: g.to,
               atEvent: carShow[g.gen].atEvent, inCarShow: carShow[g.gen].inCarShow };
    });

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
      summary: {
        attendees: totalAttendees,
        registrations: registrationsCount,
        funds: totalFunds,
        nextMemberNumber: nextAvailableMemberNum,
        judges: totalJudges,
        shirtTotals: shirtTotals,
        gens: gens,
        clubs: clubs
      },
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

    // ---- inner helpers -------------------------------------------------
    function bucketCol(key) {
      for (var i = 0; i < C.SHIRT_BUCKETS.length; i++) if (C.SHIRT_BUCKETS[i].key === key) return C.SHIRT_BUCKETS[i].col;
      return key;
    }
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
    if (!isBlank(rec["Member Number"])) rec["Member Number"] = toInt(rec["Member Number"]);
    return rec;
  }

  function blankRecord(columns, shirtCols) {
    var rec = {};
    columns.forEach(function (c) { rec[c] = ""; });
    shirtCols.forEach(function (c) { rec[c] = 0; });
    rec["Member Number"] = "";
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

  var API = { generate: generate, formatPhone: formatPhone, genFromYear: genFromYear, dtKey: dtKey };
  root.CarShowLogic = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
