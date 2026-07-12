# ETCC Car Show App — Project Status

Last updated: 2026-07-12. **Git is fully caught up to the live site — latest commit
`12177b1`, nothing uncommitted, nothing undeployed.** The most recent work session
(2026-07-11 evening through 2026-07-12) shipped two major pieces: **(1)** a **Registration
detail modal refactor** — removed the old Edit-toggle button; all fields are now always
editable inline with Save/Cancel/Delete always visible, matching the Sponsors tab's Edit
Sponsor modal pattern; **(2)** a brand-new **Sponsor Payments feature** — tracks Cash/
Check/Credit Card payments against sponsors, with a payment section built into the Edit
Sponsor modal, four new payment columns on the Sponsors table (Payment Date/Type/Check #/
Amount), zoom controls matching the Registration tab, autosave on both the detail and
sponsor-edit modals, and an Individual-Sponsorship auto-default (Credit Card, $100) that
applies both when adding a sponsor and when editing one. Two serious bugs were found and
fixed along the way — see **"This session's work (Sponsor Payments feature...)"** below,
which also explains why earlier payment fixes appeared to have "no effect": a
`ReferenceError` was silently breaking script execution, and the payments API was never
actually wired to the server at all (everything only lived in browser memory until this
session). Two new Claude Code skills were also added: `/CarShowBegin` and `/CarShowEnd`
(read/write this file automatically at session start/end — see their descriptions in
`.claude/skills/`).

This file exists so a brand-new Claude Code session can pick up this project with no
prior conversation history. Read this fully before making changes. Previous revisions
(ending at commits `a06df91`/v1.20, `7e66bf8`/v1.38, and `1775d95`) are in git history if
you need older context. Earlier session spans (still relevant background, all committed):
a major refactor removing the offline/standalone tool entirely (the codebase supports one
deployment only — the hosted site); a "+ Add Registration" (Walk-In Member/Nonmember)
feature with member-lookup autofill, Developer > Settings, checkbox/bulk-delete; a
T-Shirts tab (4th tab) consolidating the Order Email composer (with CC/BCC) and a
printable T-Shirt Report; and a Window Card PDF form-filling feature. See the many
chronological "This session's work" sections below for full detail on each.

## What this is

A web app for East Tennessee Corvette Club (ETCC) officers to turn ClubExpress CSV
exports into a searchable Registration table, a Summary dashboard, and a Sponsors
tracker — matching/replacing an old macro-driven `.xlsm` workbook. It is **one
deployment**: the hosted site at `https://etccapps.com/apps/carshow/`, password-
protected, fully live/dynamic — registrations, sponsors, and the member roster all live
as JSON files on the server and are read fresh on every page load.

There used to be a second deployment — an offline, self-contained HTML file an officer
could double-click and drag CSVs onto, with sponsors in `localStorage` — but this
session **removed it entirely** at the user's request ("I only need the deployable
version of the website... remove all standalone code to simplify"). `App/src/app.js`
no longer has a `LIVE`/offline branch at all; it unconditionally assumes it's running
on the hosted site, reading `window.__carshowSite` (renamed from `__carshowLive`,
injected by `deploy/index.php`) for the sponsors API URL. `App/ETCCCarShow.html` is
still built by `node build.js` — but now purely as the intermediate artifact
`ftp-deploy.sh` uploads as `app-bundle.html`, not as something meant to be opened
directly. See "This session's work" for the full list of what was deleted.

## Repo / paths

- **Git repo root:** `Z:\Backup\Websites\CarShow` (this file's directory)
- **Remote:** `https://github.com/BWERepo/ETCCCarShow.git` — **this is a PUBLIC repo.**
  Never commit real credentials, password hashes, or files containing real member PII.
  Everything sensitive is gitignored — see `.gitignore` at the repo root.
- **Branch:** `main`. Latest commit as of this doc: `12177b1`.
- **App source:** `App/` subdirectory (see layout below).
- **Sibling project referenced for patterns:**
  `Z:\Backup\Websites\BusinessWebExpress\` — its `.ftp-credentials` (gitignored,
  read-at-runtime-by-the-deploy-script) pattern was copied here in an earlier session.
  This session, a **different** sibling was used as a design reference:
  `Z:\Backup\Websites\HDBS\Backup\SilentAuctionManager.zip` — its actual hamburger/nav
  CSS and markup (extracted to a scratch dir to inspect, not committed anywhere) was
  ported into this app's new off-canvas drawer menu — see "This session's work" below.
  If the drawer ever needs to more closely track SAM's real app, that zip is the
  ground truth to re-extract and diff against, not memory of what it looks like.
- **Legacy tool (superseded, do not touch unless asked):** a macro-driven `.xlsm`
  workbook series at
  `Z:\Backup\ETCC\Document Library\Restricted\Events\Car Show\Spreadsheets\`. Kept
  for history only.
- **ClubExpress CSV exports** land in `Z:\Backup\ETCC\Car Show\Exports\`, pulled via
  the `/export-carshow-data` Claude Code skill (browser-automates the ClubExpress
  admin UI; see `AUTOPULL-NOTES.md` in `App/` and the skill-behavior change below).
  This session's live run produced `registration_data20260710.csv` (11 data rows) and
  `activity_registrant_data20260710.csv` (18 data rows) — the current newest export.

## App directory layout (`App/`)

```
App/
  ETCCCarShow.html        # BUILT output — the template deploy/index.php stitches live
                            # data into (as app-bundle.html on the server — see
                            # Deployment). Not meant to be opened directly anymore
                            # (that was the now-removed offline tool). Don't hand-edit.
  build.js                # Builds ETCCCarShow.html from src/ + vendor/ + assets/
  version.json            # Auto-bumped by build.js each run (major.minor + lastBuilt)
  package.json            # deps: exceljs, jsdom, papaparse
  AUTOPULL-NOTES.md        # Why CSV export is browser-automation, not a real API
  tools/check-csvs.js      # Ad-hoc sanity check against a real (non-fixture) CSV pair —
                            # not part of the automated suite.

  src/                    # Hand-edited source, inlined into ETCCCarShow.html by build.js
    config.js              # Business rules: shirt buckets, status classification,
                             # SPONSOR_TYPES, SPONSOR_SHIRT_SIZES/SPONSOR_SIZE_INDEX,
                             # REG_TYPE (Registration tab's first column)
    logic.js               # Pure generate(regRows, actRows, opts) -> result object.
                             # Also captures rec._sponsorShirtSize (per-registrant Individual
                             # Sponsorship bonus-shirt size) for the app's CSV-sponsor sync.
    excel.js               # Builds a workbook (incl. a SponsorsSheet — its own SPONSOR_COLS,
                             # NOT the same array as app.js's; if you add a column to one,
                             # check whether the other needs it too). No longer reachable
                             # from any UI button (the offline tool's "Download Excel" was
                             # removed this session) — only still exercised by Developer >
                             # Run Regression Tests' Excel round-trip assertions.
    regression-tests.js     # Shared assertions (see Testing) — used by BOTH the Node CLI
                             # test and the in-app Developer > "Run Regression Tests"
    app.js                 # DOM rendering, state, event wiring, hamburger menu (Logout +
                             # password-gated Developer submenu — Import Members/
                             # Registrations/Run Regression Tests/Change Log), Sponsors tab
                             # (server-synced only — no more localStorage/offline branch),
                             # CSV->Sponsors auto-sync. Reads window.__carshowSite (renamed
                             # from __carshowLive) for the sponsors API URL.
    styles.css              # All CSS, incl. the off-canvas nav drawer

  assets/
    ETCClogoWhiteBackground.png   # Canonical logo copy — build.js embeds as base64 in the
                                    # header; deploy/ftp-deploy.sh also uploads this same
                                    # file to Hostinger for the login screen's <img src>.

  test/
    run-tests.js            # Node CLI: `node test/run-tests.js` — logic + Excel round-trip
    fixtures/                # Frozen synthetic CSV fixture (fabricated data, NOT real
                              # members) — NEVER point this at the live Exports folder.
                              # (dom-test.js, the old jsdom full-UI smoke test, was deleted
                              # this session at the user's explicit request — see "This
                              # session's work" below. run-tests.js is the only automated
                              # test left; UI-level behavior has no automated coverage.)

  vendor/                  # papaparse.min.js, exceljs.min.js — inlined by build.js

  deploy/                  # Hostinger deployment — see Deployment section, and
                            # App/deploy/README.md (kept in sync with this file this
                            # session — it's the more detailed day-to-day reference for
                            # deploy/ internals; read it before touching anything there).
                            # All *.json data files here are gitignored, server-only, and
                            # NEVER touched by ftp-deploy.sh.
    index.php               # Login gate AND live data-stitching template
    lib.php                  # Shared helpers: carshow_authed (dual auth), carshow_read_json_list/
                              # write_json/append_json_list (lock-guarded), carshow_safe_inline_json,
                              # carshow_send_mail (hand-rolled SMTP client)
    app-bundle.html           # GITIGNORED, server-only — a plain copy of ETCCCarShow.html
                              # uploaded by ftp-deploy.sh; index.php reads this as its template.
    _login.html               # Branded password screen (ETCC logo, purple gradient); reused
                              # verbatim by sponsor-form.php now too (see below), with a
                              # str_replace'd subtitle so the copy fits either context.
    secrets.php                # GITIGNORED, NOT auto-uploaded by ftp-deploy.sh. Defines
                              # $PASSWORD_HASH and $SMTP_HOST/$SMTP_PORT/$SMTP_USER/$SMTP_PASS/$SMTP_FROM.
    secrets.example.php        # Committed template for secrets.php
    sponsor-form.php           # "Become a Car Show Sponsor" form — NOW PASSWORD-GATED this
                              # session (same shared password/session as index.php, not a
                              # separate credential — see this session's work below). Still
                              # meant to be linked from another website; officers hand the
                              # site password to whoever needs to submit it. Appends to
                              # sponsor-submissions.json. Has a Cancel button (added this
                              # session) that always navigates to the club's main site.
    sponsor-submissions.php    # Read/write JSON API for sponsor-submissions.json.
                              # action=list/upsert/delete/clear. Dual auth (session or
                              # password) via lib.php.
    walkin-registrations.php   # NEW this session — Read/write JSON API for
                              # walkin-registrations.json (manually-added Walk-In
                              # Member/Nonmember rows from the Registration tab's
                              # "+ Add Registration" form). action=list/upsert/delete.
                              # Closely mirrors sponsor-submissions.php.
    app-settings.php           # NEW this session — small key/value settings store
                              # (app-settings.json). Currently just walkinFirstNonMember
                              # (Developer > Settings). action=get/save.
    registrations-upload.php   # Authenticated CLI-facing endpoint: stores a fresh CSV pair
                              # as registrations-data.json. Called by upload-registrations.js.
    registrations-import.php   # NEW this session — browser-based sibling of
                              # registrations-upload.php: an officer-only (session-gated)
                              # page to upload a Registration Data CSV (required) + Activity
                              # Registrant Data CSV (optional) by hand, no terminal needed.
                              # Linked from the hamburger's "Developer" submenu.
    upload-registrations.js    # Node script: POSTs the newest Exports-folder CSVs to
                              # registrations-upload.php — the CLI path to refresh LIVE data.
    members-import.php         # Officer-only (session-gated) page: upload an ETCC
                              # membership CSV -> members-data.json. Linked from the
                              # hamburger's "Developer" submenu (moved there this session —
                              # used to be its own direct "Member Database" menu item).
    logout.php                  # Destroys the shared PHP session and redirects to the
                              # club's main site
                              # (https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652).
                              # Linked from the hamburger menu.
    forgot-password.php        # PUBLIC — "Forgot password?" link target. Emails a
                              # time-limited token to a FIXED admin address via
                              # carshow_send_mail(). Stores the token in password-reset.json.
    reset-password.php         # Validates the emailed token, lets you set a new password,
                              # rewrites secrets.php — PRESERVING any existing $SMTP_* fields.
    .htaccess                  # Denies direct access to every *.json data file
    .ftp-credentials.example   # Committed template for .ftp-credentials
    .ftp-credentials            # GITIGNORED — real FTP host/user/pass, read at runtime by
                              # ftp-deploy.sh if present.
    ftp-deploy.sh               # Uploads CODE only: app-bundle.html + the .php/.html files
                              # + logo + .htaccess. Deliberately does NOT upload secrets.php
                              # or any *-data.json file. (build-snapshot.js — a separate,
                              # already-broken/deprecated "portable snapshot" script — was
                              # deleted this session; it's unrelated to this normal flow.)
    README.md                  # Deploy-specific docs, kept up to date throughout this
                              # session — the most detailed reference for hamburger-menu
                              # behavior, the sponsor-form gate, and registrations-import.php.
```

## Common commands

Run from `App/`:

- **Build the app:** `node build.js` → writes `ETCCCarShow.html`, bumps `version.json`.
  This is still required before every deploy — `ETCCCarShow.html` is the artifact
  `ftp-deploy.sh` uploads as `app-bundle.html` — even though there's no longer an
  offline distribution of it.
- **Run logic/Excel tests:** `node test/run-tests.js` — 51 assertions, updated this
  session to match the current fixture shape (Reg Type column, no walk-in placeholder
  rows) and to cover `buildManualRegistration()`; passes clean as of this doc's writing
  (see Testing below).
- **No UI-level test suite exists anymore** — `test/dom-test.js` was deleted this session
  at the user's explicit request, mid-way through being rewritten for the same
  Reg-Type/walk-in-removal staleness `run-tests.js` had. There is currently no automated
  coverage for anything DOM/app.js-level (table rendering, the Add Registration form,
  checkbox/bulk-delete, Settings, member lookup, the detail modal, etc.) — see Testing
  below.
- **Refresh the site's registration data** — two ways:
  - CLI: `CARSHOW_SITE_PASSWORD=... node deploy/upload-registrations.js`
  - Browser: hosted site → hamburger → Developer (site password) → Import
    Registrations → `registrations-import.php`, pick the two CSVs, submit.
- **Refresh the site's member roster:** hamburger → Developer → Import Members →
  `members-import.php`.
- **Deploy a code change:** `node build.js` then `bash deploy/ftp-deploy.sh` (reads
  credentials from `deploy/.ftp-credentials` automatically if present).
- **Manually push `secrets.php`:** see the one-off `curl` command documented in
  `ftp-deploy.sh`'s comments and `deploy/README.md`.

## ⚠️ Workflow rules (established across sessions, saved to Claude memory — follow these)

1. **Do not automatically run `node test/run-tests.js`** after making changes. Only run
   tests if explicitly asked ("run the tests", "test", "does this pass"). This session,
   the user said a bare **"test"** — that alone was sufficient to run it (and, at the
   time, the also-then-existing `test/dom-test.js`); treat a single "test" as the
   explicit ask. `test/dom-test.js` no longer exists (deleted this session — see "This
   session's work") — `run-tests.js` is the only automated suite now.
2. **Do not automatically `git add`/`commit`/`push`, and do not automatically run the
   FTP deploy script.** Make and build changes locally, describe what changed, then
   STOP. Only commit/push/deploy when the user explicitly says **"checkpoint"** or
   otherwise explicitly names one of those actions. **New this session:** the
   auto-mode safety classifier is inconsistent about how much a bare "checkpoint"
   authorizes — twice this session it blocked an action that a previous session's
   "checkpoint" had covered without complaint:
   - A `git push origin main` was blocked outright as "pushing directly to the
     default branch"; simply repeating the exact same push after the user re-said
     **"checkpoint: commit & push & deploy"** succeeded with no code changes needed.
   - A later bare **"checkpoint"** was accepted for commit+push but the classifier
     denied the `ftp-deploy.sh` step specifically, reasoning that "checkpoint" alone
     didn't explicitly request a deploy that time (contradicting the pattern from
     earlier in this same session, where bare "checkpoint" *did* trigger a deploy
     without objection). **Lesson: if a checkpoint's deploy or push step gets
     blocked, don't fight it or route around it — just tell the user exactly what
     was blocked and ask them to repeat "checkpoint" or say "checkpoint: commit &
     push & deploy" / "deploy" explicitly.** It reliably goes through on retry with
     that exact phrasing; this is a classifier quirk, not a real permissions problem
     you need to solve.
3. **Do not use the `mcp__Claude_Preview__*` tools, and do not otherwise self-verify**
   (starting a dev server, clicking through a feature, screenshotting) after making a
   change in this repo. The user tests manually or via the regression suites above.
4. Still **do** rebuild locally (`node build.js`) before reporting a change done —
   building is not "testing" or "deploying" in the sense of rules 1/2 above.

### Credential handling — read this before touching FTP/site passwords or SMTP creds

An automatic safety classifier (separate from normal tool permissions) blocks certain
credential-related actions regardless of user intent — see rule 2 above for this
session's push/deploy-specific instances. From earlier sessions, also blocked:
writing the FTP password to a temp file; adding an `autoMode`/`permissions.allow` rule
to suppress scrutiny of FTP or credential commands; autonomously
downloading/merging/re-uploading `secrets.php` without a fresh explicit ask.

**What does work:** the user pasting a password directly in chat for one-off use in a
single Bash command; `App/deploy/.ftp-credentials` (gitignored, created by the user
themselves, read at runtime by `ftp-deploy.sh`) — this is why `bash deploy/ftp-deploy.sh`
with no env vars has worked all of this session. **Do not** attempt to write a real
credentials file yourself, add permission/classifier rules to bypass credential
prompts, or autonomously rewrite `secrets.php`.

The site's SMTP mailbox password and FTP password are real, active credentials — not
stored in this file, in git, or in Claude's memory system.

## Deployment / hosting details

- **Live URL:** `https://etccapps.com/apps/carshow/` (the `/apps/` prefix is required
  — a solved problem from an earlier session).
- **FTP:** host `ftp.etccapps.com`, account `u177039107.carshow`, FTPS with `-k`.
  Credentials: env vars, or `deploy/.ftp-credentials`.
- **Architecture (CODE vs DATA deployed separately)** — unchanged from before this
  session; see `App/deploy/README.md`'s "Architecture" section for the full
  explanation. In short: `node build.js` + `ftp-deploy.sh` ships code
  (`app-bundle.html` + the `.php`/`.html` files); `registrations-data.json`,
  `sponsor-submissions.json`, `members-data.json`, `password-reset.json` are
  server-only, gitignored, and updated independently by officers using the app —
  **never** touched by a code deploy.
- **Header/branding simplified this session:** the page title no longer shows a
  "— Registration" suffix (now just "ETCC Car Show"), and the subtitle line
  ("Offline tool · your data never leaves this computer" / "Hosted snapshot · always
  current, password-protected") was removed entirely, along with the now-dead
  `index.php` code that used to swap that text for the hosted variant.
- **Hamburger menu is now an off-canvas drawer, SilentAuctionManager-style** (see
  `App/deploy/README.md`'s "Hamburger menu (LIVE mode)" section for the full detail):
  a real animated 3-bar icon at the far left of the header (not centered anymore —
  `header.app` dropped its `justify-content: center`), opening a fixed dark left-side
  drawer with a backdrop. LIVE-mode order: **Logout**, **Developer** (client-side
  password re-check via the same `action=login` endpoint — reveals **Import Members**
  and **Import Registrations** once entered correctly). Settings and Become a Car Show
  Sponsor were removed from this menu entirely this session (Settings still existed for
  the offline tool at the time — **that tool, and the "LIVE mode" distinction itself,
  were later removed entirely**; see the top of this doc and "This session's work").
- **`sponsor-form.php` is now password-gated** (same shared session/password as
  `index.php`, not a separate credential) — it used to be deliberately public/no-login.
  It also gained a Cancel button that always navigates to
  `https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652` (not
  `history.back()` — that failed for visitors with no prior page in their tab history).
- **Sponsors tab** gained: a select-all/per-row checkbox column with a bulk Delete
  button (replacing the old "Remove All" + "Download Excel" buttons on that tab); a
  **Reg Date** column (CSV auto-sync sponsors show their registration's own Reg Date,
  "Become a Car Show Sponsor" web submissions show their `submittedAt` timestamp,
  with a backfill fix for sponsors synced before this column existed — see below);
  Individual/Corporate/Premier filter checkboxes next to the search box; "+ Add
  Sponsor" now always opens `sponsor-form.php` in a new tab instead of the in-app
  add-sponsor modal (the modal still exists and still handles *editing* an existing
  sponsor via row click).
- **Summary tab's Shirts panel** was relabeled "Registration Shirts" and gained a
  second card, "Total Shirts Needed For Event", totaling registration shirts
  (Free+Xtra collapsed by gender) plus every sponsor's shirt pick — both cards now
  render side by side using the same `sponsor-card` styling as the Sponsors summary
  cards above them (for visual consistency and because it puts both headers on one
  line, which an earlier version of this change didn't).
- **`/export-carshow-data` skill changed behavior:** it now stops after saving the two
  renamed CSVs into the Exports folder. It no longer starts `serve.js`, injects the
  CSVs into a browser tab, or screenshots the Registration/Summary tabs — loading the
  data into the app (or the hosted site, via `upload-registrations.js` or
  `registrations-import.php`) is now a separate, user-triggered step. See
  `.claude/skills/export-carshow-data/SKILL.md`. Its companion
  `.claude/skills/export-carshow-data/serve-exports.js` is now unused by the skill
  (kept, not deleted, since deleting it wasn't asked for).
- **Row height parity:** the Sponsors tab's new checkbox column was rendering rows
  slightly taller than the Registration tab (a checkbox's intrinsic box exceeds a
  plain text baseline at the same padding). Fixed with `vertical-align: middle` on
  `table.grid` cells and `display: block; margin: 0` on the checkbox inputs — both
  tables share the same `table.grid` CSS class, so this was the only real divergence.

## This session's work (chronological, commits `05525fa..7e66bf8`)

Starting point: commit `a06df91`, app v1.20 (see the prior revision of this file, in
git history, for that session's details). This session, 14 commits:

1. **`05525fa`** — Gated `sponsor-form.php` behind the same password/session as
   `index.php` (reusing `secrets.php`'s hash — not a new credential). Serves the same
   `_login.html` with a subtitle swapped for this page's context.
2. **`bd31b9f`** — Added a Cancel button next to Submit Sponsorship on the sponsor
   form, initially calling `history.back()`.
3. **`fda4e17`** — Changed Cancel to always navigate to
   `https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652` instead, since
   `history.back()` did nothing for visitors with no prior page in their tab history.
4. **`1bb0539`** — Added `logout.php` (destroys the session, redirects to the club
   site) and a direct "Become a Car Show Sponsor" hamburger link, both LIVE-mode only.
5. **`3350783`** — Sponsors tab: added the select-all/per-row checkbox column + bulk
   Delete button with a confirmation modal (replacing "Remove All" + "Download
   Excel" on that tab); changed "+ Add Sponsor" to always open `sponsor-form.php`
   in a new tab instead of the in-app modal (after some back-and-forth on whether
   this should be LIVE-only — the user settled on unconditional).
6. *(Not a commit)* — Ran the live `/export-carshow-data` ClubExpress export for the
   first time this session (Chrome extension was connected, unlike last session):
   saved `registration_data20260710.csv` (11 rows) and
   `activity_registrant_data20260710.csv` (18 rows) to the Exports folder, then loaded
   them into a local `serve.js` instance to confirm (36 registrations, $845 funds, 4
   individual sponsors — matches what the live site later showed).
7. **`88a8937`** — Changed the `/export-carshow-data` skill itself to stop after
   saving the CSVs — dropped the old steps that started `serve.js`, injected data into
   a browser tab, and screenshotted the Summary/Registration tabs.
8. **`9bd3ecb`** — Redesigned the hamburger menu: added a password-gated "Developer"
   item (client-side re-check via `index.php`'s existing login endpoint) that reveals
   "Import Members" and a new "Import Registrations" link once unlocked. Created
   `registrations-import.php` (browser upload form, sibling of
   `registrations-upload.php`). Removed "Load different files"/"Download Excel" from
   the Registration/Summary toolbars on the hosted site only (offline tool keeps both).
9. **`00ce649`** — Removed Settings and Become a Car Show Sponsor from the LIVE
   hamburger menu (now just Logout + Developer there). Added the Sponsors tab's Reg
   Date column and Individual/Corporate/Premier filter checkboxes. Fixed a bug in the
   edit-sponsor modal that silently dropped `regDate`/`submittedAt` on every save
   (it rebuilt the record from scratch without carrying those fields through).
10. **`f287896`** — Fixed Reg Date showing blank for sponsors that were auto-synced
    from CSV *before* the Reg Date column existed (the sync is deliberately
    insert-only for every other field, to protect officer hand-edits, but Reg Date is
    derived/system data that's safe to backfill unconditionally onto existing
    records — now it does, automatically on every LIVE page load).
11. **`9f716bf`** — Added a second shirt matrix to the Summary tab, "Total Shirts
    Needed For Event" — registration shirts (Free+Xtra collapsed by gender) plus
    every sponsor's shirt pick, per size.
12. **`9bc940b`** — Relabeled that second matrix's heading (from "Combined
    (Registration + Sponsors)" to "Total Shirts Needed For Event") to use the same
    `h3` styling as "Registration Shirts" instead of a separate muted subheading.
13. **`852800b`** — Restructured the Shirts panel to reuse the Sponsors summary
    cards' exact layout (`cards sponsor-cards` / `sponsor-card` classes) so both
    headings sit on one line side by side, instead of one being a panel title and the
    other nested below it. Fixed `dom-test.js`'s now-stale panel selector (it looked
    for an `h3` with text "Shirts", which no longer existed after step 9's/11's
    relabeling) to find the "Registration Shirts" `sponsor-card` instead.
14. **`d3d6176`** — Redesigned the hamburger as a full off-canvas drawer, explicitly
    modeled on `SilentAuctionManager.zip`'s real CSS/markup (extracted to inspect,
    per the user's choice when asked how closely to match it): a real animated
    3-bar icon at the header's far left (was a centered "☰" text button on the
    right), opening a fixed dark left-side drawer with a backdrop instead of a small
    dropdown. Also removed the "— Registration" title suffix and the
    offline/hosted subtitle line entirely, and the now-dead subtitle-swap code in
    `index.php`. Updated `dom-test.js`'s menu-state assertions for the new `.open`
    class (was `.hidden`).
15. **`7e66bf8`** — Fixed the Sponsors tab's rows rendering taller than the
    Registration tab's (both use `table.grid`, but the checkbox column's intrinsic
    box was taller than baseline-aligned text at the same padding) — added
    `vertical-align: middle` and normalized the checkbox's box model.

Also this session, **not part of the numbered commits**: `deploy/README.md` was kept
in sync throughout (documents the sponsor-form gate, hamburger menu, and
`registrations-import.php` in more detail than this file); a `git push origin main`
and a bare `checkpoint`'s deploy step were each blocked once by the auto-mode
classifier and succeeded on a repeated/rephrased request — see the Workflow rules
section above.

## This session's work (v1.43 → present, 2026-07-10)

Five commits landed and were deployed (checkpointed) in order:

1. **`f2e8558`** — Added "🧪 Run Regression Tests" to the Developer submenu (reuses
   the existing Settings modal/`runRegressionTests()`, not a new implementation).
2. **`c8bbc5d`** — Added "📋 Change Log" to the Developer submenu: a modal that pulls
   commit history + repo stats live from the public GitHub API (`BWERepo/ETCCCarShow`),
   modeled on SilentAuctionManager's Change Log screen.
3. **`3d3e440`** — Fixed the Change Log's `api.github.com` fetches being silently
   blocked: Hostinger's default `Content-Security-Policy: default-src 'self'` header
   has no explicit `connect-src`, so it fell back to `default-src`'s host-only `'self'`.
   Fixed by setting an explicit CSP in `deploy/.htaccess` that allowlists
   `api.github.com` for `connect-src` while preserving the inline-script/style
   allowances the rest of this single-file app already needs.
4. **`28ae420`** — Restyled the Change Log to match SAM's actual card structure more
   precisely (one card for the stat grid as plain label/value pairs, a second flush
   card for the commit table) instead of an earlier looser approximation.
5. **`8afbbe5`** — Converted the Change Log from a centered modal into a full-page
   overlay (`.changelog-page`, fixed/full-viewport with a Back button), matching how
   SAM's Change Log is its own nav "screen," not a dialog.

**Uncommitted as of this doc's writing** (three more substantial changes, done in this
same session but not yet checkpointed):

6. Added **Reg Type** as the Registration table's first column (`config.js`
   `REG_TYPE`), three planned values (Pre-Registered / Walk-in Member / Walk-in
   Nonmember) — every CSV-sourced row is unconditionally `"Pre-Registered"`. Extended
   the on-screen table's column-pinning from 2 to 3 frozen columns
   (`pinnedClass`/`updatePinnedOffsets` in `app.js`) so Last Name/First Name stayed
   frozen alongside the new leading column; bumped Excel's frozen-pane `xSplit` from 2
   to 3 to match.
7. **Removed walk-in rows and the "walk-ins" checkbox entirely** (`logic.js` no longer
   generates the 25 blank `z-> Walk-In NN` placeholder rows; `_isWalkIn`,
   `state.showWalkins`, and every branch that checked them are gone from `app.js`;
   `--walkin`/`tr.walkin` CSS removed). `REG_TYPE` in `config.js` was pared down to
   just `PRE_REGISTERED` as part of this same change — the `WALKIN_MEMBER`/
   `WALKIN_NONMEMBER` values it briefly had are gone, since nothing can produce them
   anymore. Every row shows `"Pre-Registered"`.
8. **Removed the offline/standalone tool entirely** (see the top of this doc for the
   summary) — the user's explicit direction was "I only need the deployable version...
   remove all standalone code to simplify." Concretely:
   - `app.js`: deleted `loadSponsors`/`saveSponsors`/`SPONSORS_STORAGE_KEY`,
     `DEFAULT_IMPORT_URL`, `parseCsv`/`classify`/`ingestFiles`, the drop-zone
     (`showDropZone`/`renderDrop`/`wireDrop`, `#drop` div), `buildChangeFilesBtn`
     ("Load different files"), `downloadExcel` ("Download Excel" — dropped rather than
     given a Developer-menu equivalent, per explicit choice), the "Import from Server"
     modal (`openImportModal`/`closeImportModal`/`renderImportModal`), and every
     `if (LIVE)`/`if (!LIVE)` branch — the LIVE-only behavior is now unconditional.
     Renamed the `LIVE` variable/global to `SITE_CONFIG`/`window.__carshowSite`
     (was `window.__carshowLive`) since there's no more "not live" mode to contrast
     with. The empty-state message (no registrations loaded yet) now points to
     Developer → Import Registrations instead of a drop zone that no longer exists.
   - `deploy/index.php`: renamed the injected global to `window.__carshowSite` to
     match.
   - Deleted `App/serve.js` (offline-only local-preview server) and
     `App/deploy/build-snapshot.js` (an already-broken, unrelated "email a portable
     snapshot" script — it referenced a subtitle string removed in an earlier session
     and would throw on any invocation).
   - `styles.css`: removed the `.drop`/`.filecard` rules and the vestigial
     `header.app .sub` rule (never emitted by `build.js` since the subtitle was
     removed).
   - `build.js`: no longer emits the `<div id="drop">` container.
   - **`.claude/launch.json` (pointed `preview_start`'s "carshow-app" config at the now-
     deleted `serve.js`) was NOT deleted** — the auto-mode classifier blocked it as
     "agent startup/config territory," out of scope for a code-cleanup request. It's
     now dead/broken (would fail if `preview_start` were ever invoked with that name),
     but per this project's rules Claude Preview tools aren't used anyway. A human (or
     an explicit future ask) needs to delete or fix it.
   - Updated `deploy/README.md` (removed every offline-tool callout: the Sponsors
     section's "Offline tool" bullet, the Hamburger menu section's contrast clause and
     stale item list, the `build-snapshot.js` layout entry, the final "Dropping CSVs
     into the offline tool" paragraph) and this doc's own top sections.
   - **Not touched**: `regression-tests.js` and `dom-test.js` — per this project's
     rule, test files are only edited on an explicit "test" prompt. Both suites will
     fail as currently written; see Testing below for exactly what's now stale.

**Items 6–8 were checkpointed** as commit `a5d5989` (committed, pushed, and deployed via
`ftp-deploy.sh` after two auto-mode classifier retries — see Workflow rules above for
the exact retry phrasing that worked). The codebase is now fundamentally simpler: a
single, unconditional hosted-site code path with no dual-deployment branches, offline
file handling, or localStorage persistence.

9. **`39ccf56`** — Flattened the Registration table's Shirts column to a single
   truncated line (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
   instead of `white-space: normal`), so rows with a long shirt list no longer render
   taller than the Sponsors table's rows. Checkpointed (committed, pushed, deployed).

## This session's work (new feature, 2026-07-10, uncommitted)

Added a **"+ Add Registration" button** to the Registration tab, opening a form to
manually add someone who shows up without having pre-registered online — as either a
**Walk-In Member** (officer types their real member number, or looks it up by name) or
**Walk-In Nonmember** (auto-assigned the next number from a numbering pool kept
deliberately separate from the CSV import's own nonmember numbers). This reintroduces
`REG_TYPE.WALKIN_MEMBER`/`WALKIN_NONMEMBER` in `config.js` (removed earlier this session
as part of the old CSV-generated blank placeholder rows — this is an unrelated, new,
form-driven feature, not a revival of that old mechanism). Design decisions were
confirmed with the user via AskUserQuestion at two separate points: server-persisted
(not session-only) with a full field set, in the initial build; then, when the user
asked for a "First NonMember Number" setting and member-number lookup as a follow-up,
whether that setting should renumber the CSV's own nonmembers too (**no** — kept as two
independent pools) and whether the member roster CSV actually has a number column to
look up (**yes** — the import was extended to capture it).

Concretely, across both the initial build and the settings/lookup follow-up:
- **`config.js`** — `REG_TYPE` gained `WALKIN_MEMBER`/`WALKIN_NONMEMBER` back.
- **`logic.js`** — added `buildManualRegistration(fields, C)`, a pure function producing
  one registration record (same shape `generate()` produces: `baseColumnOrder` + the 24
  shirt bucket columns) from the form's field values — kept in this pure/testable module
  rather than app.js, same rationale as `summarizeRecords`. Extracted the shirt
  bucket-key-to-column-header lookup (`bucketCol`) from a `generate()`-local closure to
  module scope so both functions share it. `generate()` itself is untouched — walk-ins
  do **not** flow through it; see below.
- **`app.js`** — walk-ins are kept in a separate `state.walkins` array (mirroring how
  `state.sponsors` works) rather than merged into the CSV pipeline. A new
  `allRegistrations()` helper (`state.result.registrations.concat(state.walkins)`) is
  the single point `sortedRows()` reads through, so search/sort/print/the live Summary
  tab/the detail modal's Prev-Next all include walk-ins automatically with no other
  call-site changes. A new `nextAvailableWalkinNumber()` helper starts from
  `state.appSettings.walkinFirstNonMember` (default 2000, editable via Developer >
  Settings, NOT `state.result.summary.nextMemberNumber` — that CSV-only figure still
  backs the Summary tab's "Next Member #" card, unchanged) and advances past any
  Walk-In Nonmembers already in `state.walkins`, so two added back to back never
  collide with each other. Add/delete push immediately to the server
  (`upsertWalkin`/`removeWalkin`/`pushWalkinToServer`, same optimistic-local-then-fetch
  pattern as the Sponsors tab). The detail modal shows a "Delete Walk-In Registration"
  button only for rows carrying a manual `.id` (CSV rows never have one) — this is the
  only correction path; there's no edit UI (see design notes in app.js's comment above
  `openAddRegistration`). A "Look Up Member" field (shown only for Walk-In Member,
  toggled via `syncMemberNumberField()`) offers a `<datalist>` of the imported roster's
  `"Last, First"` names — an exact match auto-fills Last Name/First Name/Member Number,
  same pattern `sponsor-form.php`'s "ETCC Member Name" field already used. A new
  "⚙ Settings" Developer submenu entry (alongside the pre-existing "🧪 Run Regression
  Tests" — both open the same modal, which now has a "Walk-In Registration Settings"
  section above the regression-test section) edits/saves `walkinFirstNonMember` via
  `saveAppSettings()`.
- **New `deploy/walkin-registrations.php`** — CRUD API (`list`/`upsert`/`delete`) for a
  new `walkin-registrations.json`, closely mirroring `sponsor-submissions.php` (same
  dual-auth via `lib.php`, same lock-guarded read/write).
- **New `deploy/app-settings.php`** — small key/value settings store
  (`list`/`get`/`save`-shaped) for a new `app-settings.json`, currently just
  `walkinFirstNonMember` (default 2000, applied server-side too so a fresh page load
  always has a sane value even before any save).
- **`members-import.php`** — extended to also detect a member-number column (`Member
  Number`/`Member No`/`Member #`/`Member ID`/`ID`, same normalized matching as
  last/first name) and store it as `memberNumber` on each roster entry; purely additive
  to `members-data.json`'s existing `{name, lastName, firstName}` shape, so
  `sponsor-form.php`'s existing use of that file is unaffected. Shows whether the last
  import found a number column in its success message.
- **`deploy/index.php`** — injects `walkinsApiUrl`/`appSettingsApiUrl` into
  `window.__carshowSite` alongside `sponsorsApiUrl`; boot script now also reads
  `members-data.json` and `app-settings.json` and calls the new
  `window.__carshow.ingestMembers()`/`ingestAppSettings()` hooks.
- **`.htaccess`/`ftp-deploy.sh`** — `walkin-registrations.json`/`app-settings.json` added
  to the per-file deny list; `walkin-registrations.php`/`app-settings.php` added to the
  upload list.
- **`deploy/README.md`** — new "Walk-In registrations", "Member roster: name lookup +
  member numbers", and "Settings" sections.

**Not done / deliberately out of scope:** no edit UI for a walk-in row (delete + re-add
instead); walk-ins are not included in the Excel export (that download button doesn't
exist anywhere in the UI anymore — see the earlier offline-tool-removal work — and
`excel.js` is now only exercised by the regression tests' round-trip assertions); the
member lookup only matches on an exact "Last, First" string, no fuzzy matching.

**Status:** implemented, syntax-checked (`node --check` on all three `.js` files passed
clean), built successfully (`node build.js` → 1119 KB `ETCCCarShow.html`). No local PHP
interpreter to lint the new/changed PHP files against (same limitation as every other
PHP file in this repo — see Known follow-ups). The initial walk-in feature (items in the
first bullet list above) was deployed live via `ftp-deploy.sh` **before being committed
to git** (user said "ftp", not "checkpoint"). The settings/lookup follow-up described
below supersedes/extends it further and is also not yet deployed or committed.

## This session's work (further extension, 2026-07-10, uncommitted)

Two more asks in the same session, on top of the settings/lookup feature just described:
1. Member lookup should fill in **every** field the Add Registration form has data for,
   not just Last/First Name/Member Number.
2. Add three settings — Walk-In Car Show Registration ($50), Walk-In Auction Registration
   ($0), Preregistration ($40) — confirmed via AskUserQuestion to actually drive the Add
   Registration form's fee (not just be inert stored values): a new "Registration Type"
   dropdown (Car Show/Auction) fills in Total Fee Collected from the matching setting.

Concretely:
- **`members-import.php`** — the single `memberNumber`-only optional-column detector was
  generalized to a `field => [aliases]` table covering `memberNumber`, `phone`, `email`,
  `address`, `city`, `state`, `zip` (each independently optional — whichever columns a
  given CSV export actually has get captured, others stay `""`). The success message now
  lists which of these were actually found in the last import, instead of a
  numbers-only yes/no.
- **`app.js`** — the Add Registration form's member-lookup handler
  (`lookupInput`'s `input` listener) now also fills Phone/Email/Address/City/State/Zip
  when present on the matched roster entry. A new "Registration Type" `<select>`
  (Car Show/Auction, values from `state.appSettings.walkInCarShowFee`/
  `walkInAuctionFee`) sits next to Total Fee Collected — a form-only convenience with no
  corresponding stored column, unlike Reg Type (Walk-In Member/Nonmember), which is a
  real column. `state.appSettings`'s default object gained the three new fee keys
  (`walkInCarShowFee`, `walkInAuctionFee`, `preregistrationFee`) alongside
  `walkinFirstNonMember`. The Settings modal's single save button now validates and
  saves all four settings together (a per-field minimum: 1+ for First NonMember Number,
  0+ for the fees).
- **`app-settings.php` / `deploy/index.php`** — both `$defaults` arrays (the endpoint's
  and index.php's own pre-first-save fallback, which MUST be kept in sync — no shared
  constant between the two files, per this codebase's existing small-duplication-over-
  premature-abstraction style) extended with the three fee keys.
- **`deploy/README.md`** — "Member roster" and "Settings" sections rewritten to describe
  the fuller field set and the three fee settings' actual wiring.

**Status:** implemented, syntax-checked, built, and **deployed live via `ftp-deploy.sh`**
(user said "ftp"). Still not committed to git.

After deploying, the user reported the lookup only filled Last/First Name — Member
Number/Phone/etc. stayed blank. **Not a code bug**: `members-data.json` on the server
still held data from an import done before this feature's code existed, and a code
deploy never touches that data file (see the new "Note" in `deploy/README.md`'s Member
roster section). Re-importing the same CSV through the now-updated `members-import.php`
fixed it immediately — Member Number, Phone, Address, City, State, Zip all populated
correctly on the next lookup. (Email stayed blank — that's a real gap in this particular
member's roster data, not a bug.) **Lesson for future sessions:** after any change to
`members-import.php`'s column detection, the fix only takes effect on the next
re-import — a code deploy alone won't retroactively enrich already-imported data.

## This session's work (second extension, 2026-07-10, uncommitted)

After confirming the fix above worked, two more asks:
1. Default Club Name to `"ETCC"` when a member is selected via lookup (every roster
   entry is, by definition, an ETCC member — not itself a column in the roster CSV, so
   this is set unconditionally in the lookup handler, not copied from `match`).
2. Also capture and auto-fill Corvette Year/Model/Color from the member roster, if the
   CSV has those columns.

Concretely:
- **`members-import.php`** — `year`/`model`/`color` added to the same
  `field => [aliases]` optional-column table (`Year`/`Corvette Year`/`Model Year`,
  `Model`/`Corvette Model`, `Color`/`Corvette Color`).
- **`app.js`** — the lookup handler now also fills Corvette Year/Model/Color when
  present, and sets Club Name to `"ETCC"` unconditionally on every match.
- **`deploy/README.md`** — Member roster section updated with the new fields, the Club
  Name behavior, and an explicit "re-import after any code change here" note (added
  after the stale-data confusion above).

**Status:** implemented, syntax-checked, built, and **deployed live via `ftp-deploy.sh`**
(user said "ftp" again). Still not committed to git. The user then re-imported the
member roster CSV again (to pick up Year/Model/Color) before the next ask below.

## This session's work (third extension, 2026-07-10, uncommitted)

Two more asks:
1. Email still wasn't populating from member lookup even after multiple re-imports.
   Root cause found (not the same class of bug as the earlier "stale data" issue): the
   header-normalization step only stripped spaces/underscores, not hyphens or periods —
   a CSV header like "E-mail" normalizes to `e-mail`, which never matched the `email`
   alias. Fixed by also stripping `-`/`.` in `members-import.php`'s normalization (one
   line, applies to every column detected there, not just email).
2. Add a checkbox column + select-all + bulk "🗑 Delete" to the Registration tab,
   mirroring the Sponsors tab's existing UX. Confirmed via AskUserQuestion that this
   should cover **CSV-imported rows too**, not just Walk-Ins — chosen over the
   simpler/default option, since CSV rows have no individual server record to delete
   (`registrations-data.json` is wholly replaced by every fresh import).

Concretely:
- **`members-import.php`** — normalization now strips `-`/`.` in addition to spaces/
  underscores (`str_replace([' ', '_', '-', '.'], ...)`) — fixes "E-mail"/"E.Mail" and
  any other hyphenated/dotted header variant for every field, not just email.
- **`app.js`** — extracted `csvRegKey(rec)` from the existing `csvSponsorId()` (which now
  just prefixes it) — the same Reg-Date+name stable identity, reused for the new
  deletion feature. New `rowKey(r)` returns `r.id || csvRegKey(r)`, a single key that
  works for both Walk-In and CSV rows, used for checkbox selection
  (`state.regSelected`). `regenerate()` now filters `state.result.registrations` against
  `state.deletedCsvKeys` immediately after `LOGIC.generate()` runs (before
  `syncSponsorsFromRegistrations()`, so a deleted row can't still spawn a sponsor entry).
  `deleteSelectedReg()` routes each selected row: Walk-Ins go through the existing
  `removeWalkin()`; CSV rows get added to `state.deletedCsvKeys` and pushed to the new
  endpoint. The Registration table's pinning was generalized from a hardcoded 3-column
  scheme to a loop-based `PINNED_COUNT = 4` (checkbox, Reg Type, Last Name, First Name),
  replacing `pinnedClass()`/`updatePinnedOffsets()`'s previous hardcoded pin-1/pin-2/
  pin-3 special-casing with something that generalizes to any count.
- **New `deploy/deleted-registrations.php`** — CRUD-lite (`list`/`add` only, no
  edit/remove — these are permanent exclusions) for a new `deleted-registrations.json`,
  a flat array of `csvRegKey()` strings rather than full records.
- **`deploy/index.php`** — injects `deletedRegistrationsApiUrl`; boot script reads
  `deleted-registrations.json` and calls `ingestDeletedRegistrations()` **before**
  `ingestRows()` (order matters — same reasoning as sponsors-before-registrations).
- **`.htaccess`/`ftp-deploy.sh`** — `deleted-registrations.json` denied;
  `deleted-registrations.php` added to the upload list.
- **`deploy/README.md`** — new "Registration tab: row checkboxes + bulk delete" section.

**Not done / deliberately out of scope:** no "undo" UI for a deleted CSV row — restoring
one requires hand-editing `deleted-registrations.json` on the server.

**Status:** implemented, syntax-checked, built. Not yet deployed or committed (superseded
by the fee-logic change below before ever being deployed).

## This session's work (fourth extension, 2026-07-10, uncommitted)

Changed how the Add Registration form's Total Fee Collected gets its default: instead of
a separate "Registration Type" (Car Show/Auction) dropdown that existed only to drive the
fee, the existing **In Car Show?** field now drives it directly (Yes -> Walk-In Car Show
Registration fee, No -> the renamed Walk-In Non Car Show Registration fee) — one less
field on an already-long form, and the fee now tracks a real stored column instead of a
parallel form-only concept.

Concretely:
- **`app.js`** — removed `regFeeTypeSel` and its "Registration Type" row entirely. The
  `inCarShowSel` (`In Car Show?`) dropdown, already on the form, gained a `change`
  listener that sets `feeInput.value` from `state.appSettings.walkInCarShowFee` (Yes) or
  `walkInNonCarShowFee` (No); `feeInput`'s initial value matches `inCarShowSel`'s default
  ("No" — the first `<option>`, so `walkInNonCarShowFee`). Renamed `walkInAuctionFee` to
  `walkInNonCarShowFee` everywhere: `state.appSettings`'s default object, the Settings
  modal's input/label/save-validation, and this comment set.
- **`app-settings.php` / `deploy/index.php`** — both `$defaults` arrays renamed
  `walkInAuctionFee` -> `walkInNonCarShowFee` (kept in sync, as their comments already
  require). **No migration for any previously-saved `app-settings.json`** — reasonable
  here since nothing indicates the user had actually saved custom values yet (only
  defaults had been deployed); if that assumption turns out wrong, a stale
  `walkInAuctionFee` key would just sit unused in the JSON and `walkInNonCarShowFee`
  would silently fall back to its default (0) until re-saved through the Settings modal.
- **`deploy/README.md`** — Settings section's fee bullet updated for the new field name
  and the In-Car-Show-driven logic.

**Status:** implemented, built, and **deployed live via `ftp-deploy.sh`** (user said
"ftp"). Still not committed to git.

Immediately after, the user reported email still wasn't populating from member lookup
even after multiple re-imports — this time the real CSV header was `primary_email`
(confirmed by the user directly, not guessed). Added a `primaryemail` alias for email,
and proactively added matching `primary`-prefixed aliases for phone/address/city/state/
zip too, on the theory this export consistently prefixes contact columns that way.
PHP-only change (`members-import.php`, not part of the built JS bundle) — **deployed
live via `ftp-deploy.sh`**. The user still needs to re-import the member CSV again to
actually pick this up (not yet confirmed as of this doc's writing).

## This session's work (test suite, 2026-07-10)

The user said a bare **"test"**. Fixed `test/run-tests.js`/`src/regression-tests.js` (see
Testing below for the details) — deployed nowhere, since this only affects the Node CLI
test and the in-app Developer→Settings→Run Regression Tests button (rebuilt into
`ETCCCarShow.html` so that in-app button reflects it, but not yet pushed live).

While rewriting the companion `test/dom-test.js` (which crashed outright, `TypeError`,
on removed offline-tool elements — see Testing below), the user interrupted with an
unrelated request (see next section), then explicitly said **"delete dom-test.js"**.
Deleted. `run-tests.js` is now the only automated test in this repo.

## This session's work (editable detail-modal fields, 2026-07-10, uncommitted)

Two asks together: remove the detail modal's "Delete Walk-In Registration" button
(screenshot showed it), and pick the editable-fields feature back up — scoped via
AskUserQuestion in a prior turn (all rows including CSV-imported; every field except
Reg Date/Reg Type/Gen; Shirts stays read-only) but not yet implemented at that point.

Concretely:
- **`logic.js`** — exported the already-existing `toInt`/`toNum` helpers (previously
  module-internal) so app.js can coerce edited numeric fields without duplicating them.
- **`app.js`**:
  - Removed the "Delete Walk-In Registration" button and its click handler from
    `renderDetailModal()` entirely (superseded by real editing + the Registration tab's
    existing checkbox/bulk-delete for "start over" cases).
  - New `applyRecordPatch(rec, patch)` — merges a patch onto a copy of a record,
    recomputing Gen from Year if Year was part of the patch. Shared by `regenerate()`
    (re-applying persisted CSV-row edits every load, right after the existing
    deletion filter and before `syncSponsorsFromRegistrations()`) and
    `saveDetailEdit()` (building the just-edited record to show immediately).
  - New `EDITABLE_FIELDS`/`INT_EDIT_FIELDS`/`NUM_EDIT_FIELDS` lookup tables and
    `detailFieldItem(r, c, fieldEls)` — renders either a read-only `<li>` or (in edit
    mode, for an editable column) an `<input>`/`<select>`, registering it on `fieldEls`
    for `saveDetailEdit()` to read back. Status's `<select>` preserves the row's current
    raw value as an extra option if it's not one of Paid/Not Paid/Cancelled (real
    ClubExpress data has values like "Not paid in time limit") — otherwise saving an
    edit to an unrelated field would silently downgrade it.
  - `openDetail`/`closeDetail`/`stepDetail` all reset `state.detailEditing` — an
    in-progress edit never carries over to a different row. Prev/Next, click-outside,
    and Escape are all disabled/repurposed (Escape = Cancel) while editing, so an edit
    can't be discarded by an accidental click or arrow key.
  - `saveDetailEdit()` routes by row origin: a Walk-In (`r.id` present) merges the patch
    and calls the existing `upsertWalkin()`; a CSV row stores the patch in
    `state.csvOverrides[csvRegKey(r)]`, pushes it to the new endpoint, and replaces the
    row in-place in `state.result.registrations` (matched by key, not object reference)
    so the table reflects the edit without a full `regenerate()`.
- **New `deploy/registration-overrides.php`** — `list`/`upsert` actions for a new
  `registration-overrides.json`, a flat `{csvRegKey: patch}` object (not a list of full
  records, unlike `walkin-registrations.json`/`sponsor-submissions.json`) — each `upsert`
  fully replaces that key's stored patch.
- **`deploy/index.php`** — injects `registrationOverridesApiUrl`; boot script reads
  `registration-overrides.json` and calls the new `ingestRegistrationOverrides()`
  **before** `ingestRows()` (same ordering requirement as deleted-registrations).
- **`.htaccess`/`ftp-deploy.sh`** — `registration-overrides.json` denied;
  `registration-overrides.php` added to the upload list.
- **`deploy/README.md`** — rewrote the Walk-In section's stale "No edit UI" bullet, and
  added a new "Editable detail modal fields" section.
- **Comment cleanup**: two stale comments elsewhere in `app.js` (in
  `deleteSelectedReg()` and above `openAddRegistration()`) referenced the now-removed
  delete button by name — updated to describe current behavior.

**Status:** implemented, syntax-checked (`node --check` on all `.js` files passed clean,
including a `test/run-tests.js` re-run — still 51/51, unaffected by this feature since
it only exported two already-existing pure helpers), built successfully (`node build.js`
→ 1140 KB `ETCCCarShow.html`, confirmed via `grep` that "Delete Walk-In Registration" no
longer appears anywhere in the bundle). Not yet deployed or committed.

## This session's work (Individual Sponsorship Text, 2026-07-10, uncommitted)

Added a new "Individual Sponsorship Text" column, positioned right after "Individual
Sponsorship" per the request, that auto-defaults to a name string ("First Last", or
"First and Spouse Last" if a spouse name is present) whenever Individual Sponsorship is
> 0 and the Text field is blank.

**Important judgment call, not confirmed with the user:** the request referenced
`spouse_first_name` as an input, but a real, current registration CSV export (checked
directly — `Z:\Backup\ETCC\Car Show\Exports\registration_data20260710.csv`'s header row)
has **no spouse-related column at all**, same as the frozen test fixture. Rather than
guess a wrong CSV header name (this session already burned a couple of rounds on
guessed-wrong member-CSV header names for email — see the `primary_email` saga above),
"Spouse First Name" was implemented as a **new manual-entry-only field** (a real column,
editable via the detail modal, but with no CSV source and no ClubExpress data ever
populating it automatically). This makes the feature fully functional — an officer can
hand-type a spouse's name to get the "and Spouse" text — without depending on data that
may not exist. **If ClubExpress's export actually does have a spouse column under some
other name, tell a future session what it's called** and this can be wired up as a real
auto-populated field the same way `members-import.php`'s optional columns work.

Concretely:
- **`config.js`** — `baseColumnOrder` gained `"Spouse First Name"` (after First Name) and
  `"Individual Sponsorship Text"` (after Individual Sponsorship). Neither has a
  `renameMap`/CSV source — both come through `blankRecord()` as `""` for every CSV row,
  same as any other column nothing maps into.
- **`logic.js`** — new `sponsorshipDefaultText(rec)` (pure name-formatting) and
  `applySponsorshipTextDefault(rec)` (the insert-only "if >0 and blank, default" rule —
  mutates and returns `rec`). Called from `generate()`'s per-row build (after the
  Individual Sponsorship activity-matching loop, so the just-computed fee is visible),
  `buildManualRegistration()` (currently a no-op — that form has no Individual
  Sponsorship field), and exported for app.js. Also exported the previously-internal
  `toInt`/`toNum` helpers (needed by app.js's numeric field coercion in the detail-modal
  edit feature from the prior round, and reused here).
- **`app.js`** — `applyRecordPatch()` now also calls `applySponsorshipTextDefault()`
  after merging a patch, so an edit that pushes Individual Sponsorship above 0 (or
  clears Individual Sponsorship Text back to blank) re-triggers the default correctly.
  Both new columns added to the detail modal's `EDITABLE_FIELDS`/`DETAIL_SECTIONS`
  (Registration section, right after Individual Sponsorship) — plain text inputs, no
  special coercion (not in `INT_EDIT_FIELDS`/`NUM_EDIT_FIELDS`).
- **`excel.js`** — added column widths for both new columns to the `widthFor` map (cosmetic
  only — `regSheet()` already handles generic text columns without any code change).
- **New test coverage in `regression-tests.js`**: the fixture's Sponsor row now asserted
  to auto-default to "Sponsor Sample"; Alice (no sponsorship) asserted to stay blank; a
  dedicated `sponsorshipTextAssertions()` block directly unit-tests
  `applySponsorshipTextDefault()`'s four cases (no spouse, with spouse, sponsorship=0 stays
  blank, already-set value never overwritten). **58 assertions total now, all passing.**
- **`deploy/README.md`** — new "Individual Sponsorship Text (and Spouse First Name)"
  section.

**Not added:** no changes to the Add Registration form (Walk-Ins have no Individual
Sponsorship concept in that form today) — both new fields are still reachable for a
Walk-In afterward via the detail modal, same as any other editable field.

**Status:** implemented, syntax-checked (`node --check` on all four touched `.js`
files), all 58 `run-tests.js` assertions passing, built successfully (`node build.js` →
1145 KB `ETCCCarShow.html`, confirmed via `grep` that the new column names and
`applySponsorshipTextDefault` appear in the bundle). Not yet deployed or committed.

## This session's work (Paid Registrations API, 2026-07-10, uncommitted)

Added a read-only external API — `paid-registrations-api.php?key=...` — for another
website to consume this event's paid registrations (Member Number, First Name, Last
Name, Phone, Email — confirmed with the user via AskUserQuestion, who chose this exact
field set over two more conservative "public-safe" presets offered), plus a new
Developer → 🔌 API full-page screen (modeled on the Change Log's `.api-page` full-page
overlay, not the small Settings modal) to display/test/rotate it.

**Key architectural decision:** there is no PHP port of `logic.js`'s `generate()`
pipeline (shirt buckets, Corvette generation, non-member numbering, activity matching,
deletions, detail-modal overrides, Walk-Ins) — it's 100% client-side JS. Rather than
duplicate that whole pipeline in PHP (a second implementation that would inevitably
drift from the first), the officer's browser — which already computes the fully-merged,
always-current list via `allRegistrations()` — pushes a filtered "paid" snapshot to the
server every time something paid-status-related changes (CSV import, a detail-modal
Status edit, a Walk-In add/edit/delete, a bulk delete). The external endpoint just
serves whatever was last pushed — freshness depends on an officer having the app open
when something changes (in practice, at most a page-load stale, since a fresh load
re-syncs unconditionally too).

Concretely:
- **`app.js`** — new `syncPaidRegistrationsCache()`, called from every registration-
  mutating point (`regenerate()`, `deleteSelectedReg()`, `saveDetailEdit()`,
  `upsertWalkin()`, `removeWalkin()`): filters `allRegistrations()` to rows where
  `classifyStatus(r["Status"]) === "paid"` (the same bucketing the Registration tab's own
  Paid/Not Paid/Cancelled/Empty filter checkboxes already use), maps to the 5-field
  camelCase shape, and POSTs it to `paid-registrations-cache.php`. New Developer → 🔌 API
  full-page screen (`openApiPage`/`renderApiPage`/`closeApiPage`, `#apiHost`, Escape-key
  wired in `init()`): shows the exact external URL (with Copy), the API key (masked, with
  Show/Hide), a Rotate Key button, and a Test button that fires the literal request
  another website would make (`credentials:"omit"`) and shows the raw HTTP status +
  response.
- **New `deploy/paid-registrations-cache.php`** — internal writer, POST-only, same
  session/password dual auth (`carshow_authed()`) as every other endpoint. Writes
  `paid-registrations-cache.json`.
- **New `deploy/paid-registrations-api.php`** — external reader, GET-only, **not**
  gated by the site password at all — a completely separate, narrower credential
  (`app-settings.json`'s `externalApiKey`), checked via `hash_equals()`, accepted as an
  `X-Api-Key` header or `?key=` query param. Just serves the cache file's contents.
- **`app-settings.php`** — `externalApiKey` generated at random
  (`bin2hex(random_bytes(16))`) the first time it's missing (in `get`, and mirrored in
  `index.php`'s boot script — whichever runs first persists it) — deliberately **never**
  hardcoded, since this repo is public. New `rotate_api_key` action generates and
  persists a fresh key, immediately invalidating the old one.
- **`deploy/index.php`** — injects `paidRegistrationsCacheApiUrl`; mirrors the
  generate-if-missing `externalApiKey` logic so a brand-new deploy has a real key from
  its very first page load, not just after someone opens the API screen once.
- **`.htaccess`/`ftp-deploy.sh`** — `paid-registrations-cache.json` denied;
  `paid-registrations-cache.php`/`paid-registrations-api.php` added to the upload list.
- **`styles.css`** — new `.api-page*`/`.api-card`/`.api-url-input`/`.api-response` rules,
  independently defined (not shared classes) alongside the near-identical
  `.changelog-page*` rules — matches this codebase's existing small-duplication-over-
  premature-abstraction style.
- **`deploy/README.md`** — new "Paid Registrations API" section.

**Not done / deliberately out of scope:** no automated test coverage (this all lives in
`app.js`/PHP, neither of which has any automated suite — see Testing below); no rate
limiting or request logging on the external endpoint; no way to scope the key to fewer
fields or add additional consumers with separate keys (one key, one field set, for now).

**Status:** implemented, syntax-checked (`node --check` on `app.js`; every inline
`<script>` block in the built bundle parse-checked via `new Function()`, since no local
PHP interpreter exists to lint the new/changed PHP files — same limitation as every
other PHP file in this repo), built successfully (`node build.js` → 1155 KB
`ETCCCarShow.html`), `node test/run-tests.js` still 58/58 (this feature doesn't touch
`logic.js`/`config.js`, so no new assertions were added — see Testing below). Not yet
deployed or committed.

## Testing

This session, the user said a bare "test" — per this project's rule (see Workflow rules
above), that's the explicit ask to actually update the suites, not just run them
as-is. What happened:

- **`test/run-tests.js`** (pure logic + Excel round-trip, via `src/regression-tests.js`)
  — fixed to match current behavior: 3 registrations (not the old walk-in-inflated 28),
  next-member-# 8002 (not 8027), a 5-row Excel sheet (not 30), first Excel column header
  "Reg Type" (not "Last Name"). Also added new coverage for `buildManualRegistration()`
  (the Add Registration form's record-builder — a Walk-In Member with a typed number,
  and a Walk-In Nonmember falling back to an auto-assigned number), since that's new
  code this session introduced with no prior test coverage at all. **51 assertions, all
  passing** as of this doc's writing.
- **`test/dom-test.js` was deleted**, at the user's explicit request, partway through
  being rewritten for the same staleness (it crashed outright — `TypeError` — on the
  removed "Load different files" button, among other now-nonexistent offline-tool
  elements; see git history before this session's `39ccf56` if you want to see what it
  used to check). **There is currently no automated UI/DOM-level test coverage at all.**
  Everything in `src/app.js` — table rendering, search/sort/filters, the detail modal,
  the Add Registration form, checkbox/bulk-delete, Developer→Settings, the member
  lookup, the Change Log, print, zoom — is verified only by manual testing in a real
  browser. If a future session is asked to rebuild UI test coverage, `run-tests.js` +
  `regression-tests.js`'s pure-logic-layer assertions are unaffected by this and remain
  a decent template for how this app's tests are structured (shared assertion list,
  `eq()` helper, embedded fixture data) even though jsdom/DOM setup would need to be
  rebuilt from scratch.
- The Sponsors/Registration tabs' checkbox/bulk-delete UI, the Developer password gate,
  the Change Log, member lookup/autofill, Developer→Settings, and all the PHP endpoints
  have **no automated test coverage** — verified only by manual review (no local PHP
  interpreter available) and manual browser testing before each deploy/checkpoint.

## Known follow-ups / things a new session might need to know

- **No open bugs** as of this doc's writing, but **both test suites are currently
  broken as written** (see Testing above) — this is expected staleness from three
  uncommitted product changes, not a regression, and per this project's rule won't be
  fixed until the user explicitly says "test."
- **`.claude/launch.json` still points `preview_start`'s "carshow-app" config at the
  now-deleted `App/serve.js`.** Claude was blocked from deleting this file (auto-mode
  classifier treats `.claude/` config changes as out of scope for a code-cleanup ask)
  — it's dead/broken but harmless since this project's rules already say not to use
  Claude Preview tools. Delete or fix it by hand, or explicitly ask a future session to.
- **The site password and SMTP mailbox password are real, active, unknown to Claude.**
  Do not attempt to regenerate/guess/reset either without being explicitly asked.
- **`registrations-data.json` and `members-data.json` changed on the live server mid-
  session independent of any deploy** (observed via FTP directory listings between
  checkpoints) — almost certainly an officer (the user) exercising the newly-built
  `registrations-import.php`/`members-import.php` directly on the live site outside
  this conversation, which is expected/fine (that's exactly what those pages are for)
  and not something `ftp-deploy.sh` did or could do.
- **`deploy/app-bundle.html`, `registrations-data.json`, `sponsor-submissions.json`,
  `members-data.json`, `password-reset.json` are all server-only, gitignored, and not
  present in a fresh clone of this repo.** A brand-new deploy to a different server
  would need `secrets.php` from the `.example` template, `deploy/.ftp-credentials`
  from its `.example`, then `node build.js` + `bash deploy/ftp-deploy.sh`.
- **No PHP available on this dev machine** — every PHP file, including the two new
  ones this session, was written and reviewed by hand, never linted or executed
  locally. If something in `deploy/*.php` misbehaves, that's the most likely root
  cause class to check first.
- **`_data.html` still sits on the server** as an inert leftover from a
  rearchitecture two sessions ago. Harmless; fine to leave or manually delete via FTP.
- **`.claude/skills/export-carshow-data/serve-exports.js`** is no longer used by the
  skill (the skill stops before the app-loading step that needed it) but was not
  deleted — nothing currently references it. Safe to delete in a future session if it
  keeps sitting unused, or safe to leave.
- If `/apps/carshow/` ever starts 404ing again, that was a solved problem from a much
  earlier session (the `/apps/` prefix requirement) — re-read older revisions of this
  doc in git history before spending time on it again.
- **This session's export used real, current ClubExpress data** (11 registrations,
  18 activity rows, as of 2026-07-10) — the previous doc's fixture reference
  (2026-07-08 exports) is now stale; the Exports folder's newest files are the
  2026-07-10 ones referenced throughout this doc.

## This session's work (Reg Number column rename/reorder, 2026-07-10, uncommitted)

Two small asks: move the "Member Number" column to sit before "Reg Type" (was after
"Spouse First Name"), and rename it to "Reg Number". Since this column doubles as both
the app's internal data key (`rec["Member Number"]`, read/written throughout
`logic.js`/`app.js`/`excel.js`) and its own display label everywhere it appears — this
codebase has no separate internal-key-vs-display-label concept for any column — the
rename is a pervasive find-and-replace, not a cosmetic label swap.

**Scope boundary (deliberately NOT renamed):** the ETCC **member roster** lookup
feature (`members-import.php`, `state.members`, `match.memberNumber`, the Add
Registration form's "Look Up Member" datalist) is a distinct concept — a roster entry's
own stored membership number, independent of any specific registration — and was left
untouched. The Summary tab's/Excel's "Next Member #"/"Next Available Member Number"
capacity-planning figure (`summary.nextMemberNumber`) is also a separate, pre-existing
concept and was left untouched. The **external Paid Registrations API's** JSON field
name (`memberNumber`, in `paid-registrations-api.php`'s response) was deliberately kept
stable as a public contract for the other website already consuming it — only its
internal source (`r["Reg Number"]`, was `r["Member Number"]`) was updated to match.

Concretely:
- **`config.js`** — `baseColumnOrder` moved `"Reg Number"` (renamed from `"Member
  Number"`) to the front, before `"Reg Type"`. Added `renameMap: {"Member Number": "Reg
  Number", ...}` so CSV import still correctly maps ClubExpress's own literal "Member
  Number" header (unchanged on their end) into the app's renamed column.
- **`logic.js`** — every `rec["Member Number"]` read/write (non-member auto-numbering,
  `buildRecord`/`blankRecord`, `buildManualRegistration`) renamed to `rec["Reg
  Number"]`. `buildManualRegistration`'s own `fields.memberNumber`/
  `fields.nextAvailableMemberNumber` parameter names were deliberately left as-is (they
  describe the walk-in form's own "what number to use" input, not the column itself).
- **`app.js`** — every table/detail-modal/Excel-numeric-coercion/sort/search touch point
  renamed (`NUMERIC_BASE`, `NARROW_HEADER_COLS`, `EDITABLE_FIELDS`, `INT_EDIT_FIELDS`,
  the detail modal's fixed first field, the Sponsors auto-sync's `isMember` check, the
  Walk-In numbering pool's collision check). `PINNED_COUNT` bumped 4 -> 5 (checkbox, Reg
  Number, Reg Type, Last Name, First Name) so the newly-inserted leading column joins
  the frozen set while scrolling instead of displacing First Name out of it. The Add
  Registration form's number field/label/error-message and its local
  `memberNumberInput`/`syncMemberNumberField` were renamed to
  `regNumberInput`/`syncRegNumberField` and "Reg Number" for consistency with the
  renamed column they feed. `syncPaidRegistrationsCache()`'s source read updated to
  `r["Reg Number"]`, its output field name (`memberNumber`) intentionally unchanged —
  see scope boundary above.
- **`excel.js`** — frozen-pane `xSplit` bumped 3 -> 4 (matching the new 4-column pinned
  set, mirroring the `PINNED_COUNT` change); the numeric-coercion check renamed to `c
  === "Reg Number"`.
- **`regression-tests.js`** — all four `"Member Number"` assertions renamed to `"Reg
  Number"`; the Excel round-trip's "header A2" assertion updated from `"Reg Type"` to
  `"Reg Number"` (the new first column).
- **`deploy/README.md`** — "Editable:" field list and the checkbox/bulk-delete section's
  pinned-column description updated.

**Status:** implemented, syntax-checked (`node --check` on all five touched `.js`
files), verified against both the frozen test fixture (58/58 `run-tests.js` assertions
passing) and today's real ClubExpress export (`registration_data20260710.csv` —
confirmed `columns[0..2]` = `["Reg Number", "Reg Type", "Last Name"]`, zero messages,
Susan Crown's real member number 133 flows through correctly via the new `renameMap`
entry). Built successfully (`node build.js` → 1155 KB `ETCCCarShow.html`, every inline
`<script>` block parse-checked). Not yet deployed or committed.

**Deployed via `ftp-deploy.sh` this same session** (user said "ftp"). **Confirmed
caveat, flagged to the user, not yet resolved:** an FTP directory listing right after
this deploy showed `walkin-registrations.json` already present on the server (last
modified the prior day) — meaning real Walk-In data existed under the old
`"Member Number"` key before this rename shipped. Any such record shows blank for that
field until re-saved (delete + re-add the walk-in, or re-edit that field via the detail
modal) — no automatic migration was built, matching this codebase's established
tolerance for exactly this kind of small drift-on-rename (see the earlier
`walkInAuctionFee` -> `walkInNonCarShowFee` rename, reasoned through the same way). The
user has not yet confirmed whether any live Walk-In rows actually need re-saving — check
the live Registration tab for blank Reg Number on any Walk-In row.

## This session's work (Spouse First Name from member roster, 2026-07-11, uncommitted)

Follow-up to a report that "registration: spouse first name is not populated." Confirmed
by grepping every column header in both real ClubExpress export files
(`registration_data20260710.csv`, `activity_registrant_data20260710.csv`) — there is
genuinely no spouse/companion-name column anywhere (only "Companion Count", a number,
already mapped to `#`) — so a blank Spouse First Name on every CSV-imported row was
expected/by-design, not a bug. Offered the user two options via AskUserQuestion (leave
manual-entry-only, or derive it from `CSSponsorName`'s "X & Y Z" pattern); the user
dismissed that question and instead supplied new information directly: **the member
roster CSV** (imported via Developer > Import Members, separate from the registration
CSV) **has its own `spouse_first_name` column.**

Concretely:
- **`members-import.php`** — `spouseFirstName` added to the optional-column alias table
  (`spousefirstname`/`spouse`/`spousename`, same normalized matching as every other
  optional field), captured into `members-data.json` alongside `memberNumber`/`phone`/
  etc.
- **`app.js`** — new `fillSpouseFirstNameFromRoster(rec)`, called from `regenerate()`
  (after the existing deletion-filter/override-patch steps, before
  `syncSponsorsFromRegistrations()`): for a CSV-imported registration with a blank
  Spouse First Name, looks up `state.members` by `Number(rec["Reg Number"]) ===
  Number(m.memberNumber)` and backfills from the matching roster entry's
  `spouseFirstName` if present. Insert-only (never overwrites an officer's own
  detail-modal edit), and non-members (an auto-assigned placeholder Reg Number) never
  match any roster entry — correct, since there's no real membership record to backfill
  from. Routed through the existing `applyRecordPatch()` so Individual Sponsorship
  Text's own default recomputes too, in case a newly-filled spouse name is what makes
  "First and Spouse Last" possible.
- **Add Registration form deliberately NOT changed** — still no Spouse First Name field
  there (out of scope for this ask); a Walk-In's spouse name remains settable only via
  the detail modal afterward, same as before.
- **`deploy/README.md`** — "Member roster" section updated with the new field and the
  CSV-registration backfill behavior.

**Status:** implemented, syntax-checked (`node --check` on `app.js`), built successfully
(`node build.js` → 1157 KB `ETCCCarShow.html`, every inline `<script>` block
parse-checked, confirmed `spouseFirstName`/`fillSpouseFirstNameFromRoster` present in
the bundle). `run-tests.js` still 58/58 (this feature doesn't touch `logic.js`/
`config.js`, and has no fixture roster to exercise it against — see Testing). Not yet
deployed or committed. **Takes effect only after both a code deploy AND a fresh member
roster re-import** (same "re-import after any code change here" rule as every other
`members-import.php` column-detection change) — the user's real roster CSV needs
re-importing through the updated `members-import.php` to actually populate
`spouseFirstName` into `members-data.json` before any Spouse First Name backfill can
happen.

## This session's work ("Reg Number" → "Reg #", 2026-07-11, uncommitted)

Follow-up rename: every occurrence of the label "Reg Number" (itself renamed from
"Member Number" earlier this session) shortened to "Reg #" — a plain literal
find-and-replace across every file that had it (table/detail-modal/form labels, Excel
header, `NUMERIC_BASE`/`NARROW_HEADER_COLS`/`EDITABLE_FIELDS`/`INT_EDIT_FIELDS` keys,
`config.js`'s `baseColumnOrder`/`renameMap` target, `logic.js`'s read/writes,
`regression-tests.js`'s assertions, `deploy/members-import.php`'s comment,
`deploy/README.md`). **`renameMap`'s CSV-source-side key stayed `"Member Number"`**
(unchanged — that's still ClubExpress's own literal column name; only the translation
target changed). The Paid Registrations API's external `memberNumber` JSON field name
was already stable through the prior rename and remains untouched here too.

**Status:** implemented via a scripted literal replace across 7 files, syntax-checked,
58/58 `run-tests.js` assertions passing (header A2 now "Reg #"), verified against
today's real ClubExpress export (columns[0..2] = `["Reg #", "Reg Type", "Last Name"]`,
Susan Crown's Reg # = 133, zero messages), built successfully (`node build.js` → 1157 KB
`ETCCCarShow.html`, every inline `<script>` block parse-checked, zero remaining "Reg
Number" hits anywhere in `src/`/`deploy/`). Not yet deployed or committed.

## This session's work (committed through `f7160b9`, 2026-07-11)

Four small, already-committed rounds followed the "Reg Number" → "Reg #" relabel above,
each checkpointed (commit + push + deploy) individually:

1. **`ee1950b`** — Removed "Reg #" from `NARROW_HEADER_COLS` (`app.js`). That dict force-
   wraps a header onto two lines by capping its width to fit the data instead of the
   label — right for the old, longer "Member Number"/"Reg Number" text, wrong once the
   label was just "Reg #" (already short). Left a stray non-breaking-space fix from an
   earlier round in place (harmless once the wrap trigger itself was removed).
2. **`636e6e5`** — Summary tab: replaced the Attendees/Next Member # cards with a new
   **Paid Registrations** card (count of currently-visible rows whose Status classifies
   as "paid", via the same `classifyStatus()` the Registration tab's filter checkboxes
   use). This card was itself removed again later this session — see below.
3. **`f7160b9`** (bundled 3 changes) —
   - "Individual Sponsorship"/"Individual Sponsorship Text" shortened to "Ind.
     Spon."/"Ind. Spon. Text" everywhere (table, Excel, detail modal, sponsor sync).
     `config.js` gained a separate `individualSponsorshipCol` constant so the *column
     name* could be renamed independently of `sponsorshipActivityTitle` (which **must**
     stay the literal string "Individual Sponsorship" — that's ClubExpress's own real
     Activity Title, used to match CSV activity rows, not a label). **This rename was
     itself reverted later this session** — see below; `individualSponsorshipCol` no
     longer exists in the current code.
   - Non-breaking space added between "Reg" and "#" in the header label so it can't wrap
     between those two words at a narrow column width (the earlier `NARROW_HEADER_COLS`
     removal in `ee1950b` wasn't sufficient by itself).
   - Version bumped to 2.0 (`version.json` — `major` set to 2, `minor` reset to 0 by
     hand, then `node build.js` auto-bumps `minor` on every subsequent build as usual).

## This session's work (Sponsors tab: Member column + Ind. Spon. Text, 2026-07-11, uncommitted)

Two Sponsors-tab changes, both still live/deployed but **not yet committed**:

- **"ETCC Member Name" → "Member"** — renamed in the Sponsors table header, the edit-
  sponsor modal's field label, and Excel export (`etccMemberName` key unchanged).
  `sponsor-form.php`'s own **public-facing** "ETCC Member Name" field (a completely
  separate UI surface reached by outside sponsors/businesses) was deliberately **left
  unchanged** — out of scope for this rename.
- **New "Ind. Spon. Text" column**, positioned after "Sponsor Type" in the Sponsors
  table, print view, edit-sponsor modal (now hand-editable per sponsor via a new
  `individualSponsorshipText` field), and Excel's own separate `SPONSOR_COLS` array.
  Auto-populated from the source registration's own "Ind. Spon. Text" value when a
  sponsor is created via CSV/Walk-In auto-sync (`syncSponsorsFromRegistrations()` in
  `app.js`), plus a one-time backfill for sponsor records that predate this column
  (mirrors the existing Reg Date backfill pattern) — after that it's insert-only, so an
  officer's own edit survives future re-syncs.

## This session's work (Reverted "Ind. Spon." on the Registration page, 2026-07-11, uncommitted)

Immediately following the Sponsors-tab work above, two more asks reversed part of the
earlier `f7160b9` rename:

- **"Ind. Spon." reverted back to "Individual Sponsorship"** everywhere on the
  Registration tab/detail modal/Excel export. The `individualSponsorshipCol` config
  constant introduced in `f7160b9` was removed again — `logic.js` now writes the
  accumulated fee straight back onto `C.sponsorshipActivityTitle` (the same string used
  to match ClubExpress's Activity Title), exactly as it worked before that rename.
- **"Ind. Spon. Text" removed as a visible column** from the Registration
  tab/detail modal/Excel export (`baseColumnOrder` in `config.js` no longer lists it) —
  but it's **still computed on every record**: `applySponsorshipTextDefault()`/the
  `CSSponsorName` CSV mapping in `logic.js` still set it, and `blankRecord()` now
  explicitly initializes it to `""` even though it's not a real column (restores the
  "always blank, never undefined" guarantee the removal would otherwise have broken —
  caught by a regression-test failure, fixed, now passing again). The **only** remaining
  consumer is `syncSponsorsFromRegistrations()`, which reads a registration's
  `rec["Ind. Spon. Text"]` once to seed the Sponsors tab's own (separate, still-visible)
  Ind. Spon. Text column described above.
- Net effect: **the Sponsors tab and the Registration tab now use different labels for
  related-but-distinct concepts** — Registration tab says "Individual Sponsorship"
  (the ClubExpress activity's fee), Sponsors tab says "Ind. Spon. Text" (a sponsor's
  display-name string) — this is intentional, per explicit user instructions in two
  separate back-to-back asks, not an inconsistency to "fix."

## This session's work (Summary tab: Funds formula + card removal, 2026-07-11, uncommitted)

Two follow-up asks about the Summary tab's **Funds** card:

- **Funds now = sum(Total Fee across currently-visible registrations) + Premier sponsor
  fees + Corporate sponsor fees** (`sponsorStatsByType("premier").total +
  sponsorStatsByType("corporate").total`, computed in `buildSummaryView()`). **Individual
  sponsors are deliberately excluded** from this addition — their $100 fee already shows
  up once inside the sponsoring registrant's own Total Fee (Individual Sponsorship is an
  add-on activity purchased as part of a registration), so adding
  `sponsorStatsByType("individual").total` too would double-count it. Premier/Corporate
  sponsors are standalone businesses with no registration of their own, so their fee has
  no other way to reach this total.
- **The "Paid Registrations" card (added in `636e6e5` above) was removed again** — Summary
  tab's card row is now just **Registrations, Funds**. (The unrelated Developer > 🔌 API
  "Paid Registrations API" feature/screen was untouched by either change — different
  feature, same words.)

## This session's work (sponsor-form.php: context-aware redirects, 2026-07-11, uncommitted)

`sponsor-form.php` (the "Become a Car Show Sponsor" form) can be reached two ways: from
inside the app itself (Sponsors tab's "+ Add Sponsor" button, which `window.open()`s it
in a new tab) or from an outside link (ClubExpress/the club's main site). Both **Submit**
and **Cancel** now behave differently depending on which:

- The "+ Add Sponsor" button now opens `sponsor-form.php?from=app` (was a bare URL).
- That query param is carried through as a **hidden `from` form field** (not just relied
  on via the URL's query string, which a `<form method=post>` with no explicit `action`
  would normally forward on its own — the hidden field is a more robust belt-and-
  suspenders approach, and survives a validation-error re-render too).
- **Submit**, on success: `from=app` → `header('Location: index.php#sponsors')` (a fresh
  page load landing straight on a Sponsors tab that already shows the new entry — see
  `app.js`'s `init()`, which checks `location.hash === "#sponsors"` and pre-selects that
  tab before the first render). Anything else → redirects to
  `https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652` (the club's main
  site), since an outside sponsor/business has no reason to land inside the internal app.
- **Cancel** branches the exact same way via a small `$cancelUrl` PHP variable (same two
  destinations, same condition).
- The old static "Thank you! Your sponsorship information has been submitted." success
  page (and its now-dead `$submitted` flag / `.success` CSS rule) was removed — a
  successful submission always redirects now, never renders that page.

## This session's work (Car Show Window Card — new feature, 2026-07-11, uncommitted)

A substantial new feature, scoped via two rounds of `AskUserQuestion` before building:
officers can upload a background image in Settings, and print a small portrait "window
card" (for a car's dashboard/windshield) per registrant, with that image as a background
and five of the registrant's fields printed on top. Confirmed scope: **full print
generation** (not just image storage), fields = **Reg #, Name, Year, Model, Generation**,
image = **background behind the info**, trigger = **per-row only from the detail modal**
(later extended to also support **bulk printing from the Registration tab**, restricted
to rows where **In Car Show? is exactly "Yes"** — a separate, later ask).

**Uploading the image — Developer > ⚙ Settings > "Car Show Window Card":**
- New file-picker + Upload button (PNG/JPG/GIF/WEBP, 5 MB max) with a live preview of the
  current image (cache-busted via a `state.windowCardImageVersion` counter bumped on each
  successful upload).
- New endpoint **`deploy/window-card-image.php`** — session/password dual-authed
  (`carshow_authed()`), accepts a **multipart** POST (not JSON like every other settings
  save, since it's a real file) with a single `image` field. Validates size (≤5 MB) and
  MIME type via `getimagesize()`, saves to disk as `window-card.<ext>` (png/jpg/gif/webp)
  under `deploy/`, **overwriting** any prior upload and **deleting** a differently-
  extensioned leftover from an earlier upload (so there's never more than one live copy).
  Then updates `app-settings.json`'s new `windowCardImage` key with the current filename
  — read-modify-write without clobbering other settings, same pattern
  `app-settings.php` itself already uses.
- The image is **deliberately NOT denied by `.htaccess`** (unlike every JSON data file) —
  it needs to be publicly loadable via `<img src="window-card.png">` when a card is
  printed, same as `ETCClogoWhiteBackground.png` already is.
- `windowCardImage` (default `""`) added to **three** places that must stay in sync by
  hand (no shared constant, per this codebase's established style): `state.appSettings`'s
  default object in `app.js`, `app-settings.php`'s `$defaults` array, and `index.php`'s
  `$appSettingsDefaults` array.
- `window-card-image.php` added to `ftp-deploy.sh`'s upload list; **`window-card.<ext>`
  itself is never uploaded by that script** (server-only, live data, like every other
  `*.json` data file — just not JSON and not `.htaccess`-denied).

**Printing — two entry points, one shared engine:**
- **Detail modal** — new "🪟 Print Window Card" button (next to ✎ Edit, hidden while
  editing) calls `printWindowCard(r)`, a 1-element wrapper around the shared
  `printWindowCards(list)`.
- **Registration tab toolbar** — new "🪟 Print Window Cards" button
  (`printSelectedWindowCards()`) prints one card per **checked row whose In Car Show? is
  exactly "Yes"**; a checked row with any other value is silently skipped. The button's
  own label shows a live count of how many checked rows currently qualify (e.g. "🪟 Print
  Window Cards (3)") and stays disabled at 0 — reuses the same `state.regSelected`
  checkbox state the bulk-delete button already reads; the count logic lives in
  `renderRegBody()` alongside the existing `#regDeleteBtn` label/enable-state update.
- **`printWindowCards(list)`** (`app.js`) builds one `.window-card-print` div per row in
  `#printHost`, each with: a real `<img class="wc-bg">` of the uploaded image (**not** a
  CSS `background-image`, since most browsers silently drop background images from print
  output unless the user manually enables "Background graphics" — this was an actual bug
  hit and fixed mid-session, see below) filling the card via `position:absolute;
  object-fit:cover`, plus a semi-opaque white panel (`.wc-fields`) anchored at the bottom
  listing Reg #, Name, Year, Model, and Generation as five separate lines. Each card is
  forced onto its own printed page (`page-break-after: always` on all but the last).
- **Page size** — `printRegistration()`/`printSponsors()` already share one global
  landscape `@page` rule (for their wide tables). Window cards need a small portrait page
  instead, so `printWindowCards()` injects a **one-off `<style>` tag** with
  `@page { size: 5.5in 8.5in; margin: 0.25in; }` right before calling `window.print()`
  (later `@page` rules win, same cascade order as normal CSS), then removes that
  `<style>` tag on the browser's `afterprint` event so it doesn't leak into a later
  Registration/Sponsors print job.

**Bug found and fixed mid-session (real, user-reported):** the very first version printed
a completely blank page. Root cause: `.window-card-print`'s **base** (non-print) rule is
`display: none;` (so it doesn't show/take space outside of printing) — but the
`@media print` rule that repositions/sizes it **never re-declared `display`**, and CSS
does not clear a property just by being inside a different media query; the outer
`display: none` kept applying even during print, so the whole card stayed invisible no
matter how correct its position/size CSS was. Fixed by adding `display: block !important;`
inside the `@media print` rule. While investigating, also noticed (and fixed) that a
stray `.loadedinfo` "CSVs loaded: ..." text line was never in the print hide-list at all
— it was the only thing visible on that first blank-looking printout, which is what
made the bug obvious from the screenshot. Both fixes deployed and confirmed building
correctly; not yet re-tested against a real printer/PDF by the user as of this doc's
writing.

## This session's work (In Car Show filter + T-Shirt Vendor Email, 2026-07-11, uncommitted)

Two small, independent asks handled together:

- **"In Car Show" checkbox** added to the Registration tab's Status filter group, right
  after "Empty" (`state.inCarShowFilter`, default off). When checked, `visibleRows()`
  additionally requires `In Car Show? === "Yes"` (case-insensitive), on top of whatever
  Status buckets and search text are already active.
- **T-Shirt Vendor Email setting** — new "T-Shirt Vendor" section in Developer > ⚙
  Settings with a single "Vendor Email" text field (`tshirtVendorEmail`, default `""`),
  saved via the same Save button as the other Registration Fees fields. Explicitly
  **reference-only** — not wired to send anything automatically anywhere in the app (the
  Settings screen's own hint text says so). Light validation: must contain `@` if
  non-blank. Added to the same three defaults-sync locations as `windowCardImage` above
  (`app.js`, `app-settings.php`, `index.php`).

## This session's work (window-card PDF rework + T-Shirt features, 2026-07-11, uncommitted)

Two checkpoint commits landed from prior session rounds (`83e8fd6` "Sponsors/Summary/sponsor-form updates..." and `1775d95` "Window card: bigger field text..."), and this session added more features (not yet committed):

### Window Card PDF form-filling rework (replaces image-overlay approach)

The original Window Card feature printed by overlaying text on an uploaded PNG/JPG image. This was replaced with a fillable PDF template approach:

- **Vendored `pdf-lib.min.js`** (525 KB) into `App/vendor/` and added to `build.js` inline-bundle; exposes `window.PDFLib` UMD global.
- **Replaced `window-card-image.php` with `window-card-pdf.php`** — same session/password dual auth, accepts multipart upload (file field `pdf`, 5 MB max), saves as `window-card.pdf` on server (gitignored, like all data files).
- **Settings key renamed**: `windowCardImage` → `windowCardPdf` everywhere (`app.js`, `app-settings.php`, `index.php`, `deploy/index.php` injection).
- **`fillOneWindowCard()` reworked** to use `PDFLib.PDFDocument.load()`, embed `StandardFonts.HelveticaBold`, fill form fields (Owner/CarNumber/Year/Model/Generation) at fixed **36pt bold**, call `form.updateFieldAppearances()` to apply the font, then `flatten()` to bake the values into the page.
- **`printWindowCards()` layout changed**: each filled card is embedded (not copied) onto a fresh 8.5×11in **landscape** output page, scaled to **75% of page size** (was 50%) while preserving aspect ratio, **centered** both horizontally and vertically. Each card gets its own printed page (`page-break-after`). One output PDF opened in a new tab for printing.
- **Image-load race condition fixed**: `printWindowCards()` now waits for every embedded image (if still using the old raster approach for some reason) to fire `load` or `error` before calling `window.print()`, with a 3-second safety fallback.
- **Old cleanup**: `window-card.png` (raster asset) and `window-card-image.php` remain on the server as harmless leftovers; nothing references them anymore.
- **Template expectations**: the fillable PDF's form fields (`Owner`, `CarNumber`, `Year`, `Model`, `Generation`) must exist; missing fields are silently skipped rather than erroring out.

### T-Shirt Order Email feature (new Developer submenu item)

A full-page screen (like the existing API and Change Log screens) that composes and sends a T-shirt order email to the Vendor Email address configured in Settings:

- **New state fields** in `app.js`: `emailPageOpen`, `emailSubject`, `emailSending`, `emailSendError`, `emailSent`.
- **New functions**:
  - `tshirtOrderShirtCounts()` — returns array of shirt sizes with Men's/Women's counts (paid registrations + all sponsor shirt picks, combined).
  - `tshirtEmailSponsorList(typeKey)` — filters `state.sponsors` by type (premier/corporate/individual).
  - `buildTshirtOrderEmailBody()` — plain-text email body: PREMIER SPONSORS (with websites), CORPORATE SPONSORS (with websites), INDIVIDUAL SPONSORS (with Ind. Spon. Text), SHIRT COUNTS (by size).
  - `openEmailPage()` / `closeEmailPage()` / `renderEmailPage()` / `sendTshirtOrderEmail()` — state management and UI.
- **Rendering**:
  - To field: shows configured Vendor Email from `state.appSettings.tshirtVendorEmail` (read-only); errors if not set.
  - Subject field: editable text input, defaults to "ETCC Car Show — T-Shirt Order" if not already set.
  - Preview: `<pre>` block showing the exact plain-text body that will be sent (Premier/Corporate/Individual sections + shirt totals).
  - Send button: disabled if no vendor email configured; shows "Sending…" while in flight; shows "Sent!" confirmation on success.
- **Server endpoint**: **`deploy/send-tshirt-order-email.php`** (new file). POST-only, session/password dual auth via `carshow_authed()`. Reads `subject` + `body` from JSON request body. **Reads recipient email server-side** from `app-settings.json` (never trusts client-supplied address — keeps Settings as single source of truth, prevents mis-routing). Calls `carshow_send_mail()` via the hand-rolled SMTP client in `lib.php`. Returns `{ok, error?}` JSON.
- **Integration**:
  - `window.__carshowSite.sendTshirtOrderEmailApiUrl` injected in `deploy/index.php`.
  - Added to `ftp-deploy.sh` upload list.
  - "📧 T-Shirt Order Email" menu item in Developer submenu (alongside API, Change Log).
  - Escape key closes the page.
  - `.email-page*` CSS (fixed full-page overlay, matching `.api-page` / `.changelog-page` pattern).

### T-Shirt Report feature (new Developer submenu item)

A full-page screen showing all paid registrations sorted by last name, with their shirt info:

- **New state field**: `tshirtReportOpen`.
- **New functions**:
  - `openTshirtReportPage()` / `closeTshirtReportPage()` / `renderTshirtReportPage()` — state and UI.
- **Rendering**:
  - Gathers all paid registrations (CSV + Walk-Ins, filtered by `classifyStatus() === "paid"`).
  - Sorts by Last Name, then First Name (case-insensitive).
  - Table with columns: Last Name | First Name | Shirts.
  - Shirts column reuses `shirtSummaryText(r)` (existing helper that formats shirt buckets as readable text).
  - Empty state message if no paid registrations.
- **Integration**:
  - "📊 T-Shirt Report" menu item in Developer submenu.
  - Escape key closes the page.
  - `.tshirt-report-page*` CSS (fixed full-page overlay, matching other report pages).

### Other changes

- **Sponsors tab**: "Ind. Spon. Text" column label renamed to "Individual Sponsorship Text" (both table and edit-sponsor modal, 2 occurrences).
- **No test changes**: `test/run-tests.js` and `regression-tests.js` remain unchanged (58/58 assertions still passing, verified during email/report build).

**Status**: All features implemented, syntax-checked, built successfully (`node build.js` → 1696 KB `ETCCCarShow.html`). All new PHP endpoints reviewed by hand (no local PHP interpreter to lint). **Deployed via `ftp-deploy.sh`** but **not yet committed to git** — waiting for `checkpoint` command.

## **CRITICAL: Current Deployment State**

**Git is fully caught up — commit `12177b1`, working tree clean (only an untracked
`Images/` folder, unrelated to the app), nothing uncommitted, nothing undeployed.**
Every commit in this session (see the two "This session's work" sections below covering
`17ec139`..`6b77037` and `12177b1`) was individually built, deployed via
`ftp-deploy.sh`, then committed and pushed — so git, the live site, and this doc are all
in sync as of this update. There is no pending checkpoint to run.

**Live version:** `v2.61`, last JS rebuild `2026-07-11T20:40:50Z`. Note: several PHP-only
changes (the `sponsor-payments.php` endpoint, `index.php` wiring, `sponsor-form.php`
payment fields) landed *after* that JS rebuild timestamp but don't bump `version.json`
since `node build.js` wasn't re-run for them — they're deployed via `ftp-deploy.sh`
independently of the JS bundle version. If you need to confirm what's live, check each
file's mtime in the deploy directory rather than relying solely on the footer version.

**"checkpoint" is explicitly defined (user's own words) as commit + push + deploy, all
three, every time** — see [[feedback-checkpoint-workflow]] in Claude's memory system
(note: the memory file's `name`/`description` frontmatter format was tightened by the
user/a linter partway through this session — don't revert that). A bare "checkpoint"
should attempt all three in one go, not stop after commit.

**Known follow-ups for a fresh session to be aware of:**
- **Sponsor Payments feature has not been end-to-end verified live** by the user beyond
  the specific bugs reported and fixed during this session (see below). The full flow —
  add a new Individual sponsor via "+ Add Sponsor", confirm Payment Type/Amount
  auto-fill to Credit Card/$100, submit, confirm the Sponsors tab shows the payment
  columns populated after redirect, confirm it *survives a page reload* — has not been
  walked through live since the `sponsor-payments.php` persistence fix landed. This is
  the single highest-value thing to verify first in a new session if payments come up.
- **No local PHP interpreter available** in this environment — every PHP file
  (`sponsor-payments.php`, `index.php`, `sponsor-form.php` changes) was reviewed by hand
  and brace/paren-balance-checked, never actually executed, before deploy. Same
  limitation as every other PHP file in this repo.
- **Window card PDF changes** (from the prior session): the fillable-PDF form-filling
  approach has still not been verified against a real print/PDF by the user. The 75%
  scale on 8.5×11 landscape and 36pt bold font are configured but visually unconfirmed.
- **Old window-card files**: `window-card.png` and `window-card-image.php` remain on the
  server as unreferenced leftovers from the pre-PDF approach — harmless, could be
  manually cleaned up via FTP if desired.
- **Test suites unchanged and still passing** (`node test/run-tests.js` → 58/58) — the
  Sponsor Payments feature and detail modal refactor are both UI-only work that doesn't
  touch `logic.js`'s `generate()`, so no new fixture assertions were needed.
  `regression-tests.js`'s header comment documents which UI-only features are instead
  manually tested in the browser.

## This session's work (T-Shirts tab + email enhancements, 2026-07-11)

**Major work: T-Shirts tab redesign (consolidated email + report into a single tab).**

### Syntax fixes and gotchas

- **Fixed missing comma in state object** (line 80: `emailSent: false` → `emailSent: false,`) after removing `emailPageOpen` and `tshirtReportOpen` flags. This caused "Unexpected identifier 'deletedCsvKeys'" error — a subtle reminder that object literal commas are mandatory between properties even when removing one. Saved as memory `feedback-replace-all-scope-risk` and updated `feedback-tab-content-data-dependency` with the bonus trailing-comma lesson.
- **Fixed missing `sendTshirtOrderEmail()` function** after a large `replace_all` operation inadvertently consumed it along with the old overlay rendering functions. Always verify function definitions survive large refactors.
- **Fixed print CSS** — added `.tshirt-view` to the `@media print { display: none !important; }` list so the tab content hides and only `#printHost` (the T-Shirt Report table) prints.

### T-Shirts tab (new 4th tab)

Consolidated two separate Developer submenu items (📧 T-Shirt Order Email, 📊 T-Shirt Report) into a single, cohesive tab alongside Summary/Registration/Sponsors. Removed those menu items entirely.

**Top section: Total Shirts Needed For Event card** — copied from Summary tab, shows men's/women's counts by size combining registration shirts (Free/Xtra collapsed by gender) + all sponsor shirt picks. Displays only when registration data exists.

**Middle section: T-Shirt Order Email composer** —
- **To field** (read-only): vendor email from Developer > Settings > T-Shirt Vendor
- **Subject field** (editable): defaults to "ETCC Car Show — T-Shirt Order"
- **CC field** (new, editable): comma-separated email addresses
- **BCC field** (new, editable): comma-separated email addresses
- **Message Body** (editable, **40 rows**, was 12 initially): plaintext, defaults to auto-generated summary (Premier/Corporate/Individual sponsors with websites, shirt counts). Officers can freely customize before sending.
- **Send button**: disabled if no vendor email configured; shows "Sending…" then "Sent!" confirmation. Sends subject, body, CC, BCC to `send-tshirt-order-email.php`.

**Bottom section: T-Shirt Report** — paid registrations sorted by last name, table with Last Name | First Name | Shirts (using existing `shirtSummaryText()`). Displays only when registration data exists.
- **Print button** ("🖨 Print"): visible only when there are paid registrations. Opens `printTshirtReport()`, which renders a clean printable version with ETCC logo (60px, centered), centered title "T-Shirt Report", report date ("Report Date: MM/DD/YYYY"), and the table. Only the report prints (tab content hidden via CSS).

### Email infrastructure updates

**Extended `carshow_send_mail()` in `deploy/lib.php`**:
- Added optional `$cc` and `$bcc` parameters (default empty string)
- Parses comma-separated email lists (via `explode(',')` and `trim()`)
- Sends `RCPT TO:<email>` SMTP command for each CC/BCC recipient
- Adds `Cc: {cc}` header to the email (BCC intentionally omitted from headers per SMTP spec)
- Maintains full backward compatibility (existing calls still work)

**Updated `send-tshirt-order-email.php`**:
- Extracts `cc` and `bcc` from JSON request body (defaults to empty string if missing)
- Passes them to the updated `carshow_send_mail()` call
- No change to recipient validation — vendor email still read server-side from `app-settings.json`

### Detail modal expansion

Added three new fields to `EDITABLE_FIELDS` so officers can edit them inline in the registration detail modal (click ✎ Edit):
- **Last Name**, **First Name**: were read-only before; now editable text inputs
- **Gen**: was read-only before; now editable text input (Corvette generation)
- All existing editable fields remain (Reg #, Club Name, Status, Total Fee, Individual Sponsorship, Spouse First Name, #, Phone, Email, Address, City, State, Zip, Year, Model, Color, In Car Show?)

Changes persist to server for CSV-imported rows (via `registration-overrides.json`) and Walk-In rows (via `walkin-registrations.json`).

### Print enhancements for T-Shirt Report

- ETCC logo fetched from header, scaled to 60px height, centered at top
- Centered h1 title "T-Shirt Report" with 24px font
- Report date line ("Report Date: 7/11/2026") in 12px muted text
- CSS ensures only the report prints (`#printHost` shown, rest of tab hidden via `display: none !important` in `@media print`)

### Status

**All features implemented, syntax-checked, built (`node build.js` → 1697 KB `ETCCCarShow.html`), deployed via `ftp-deploy.sh` at 19:25 UTC July 11, 2026.**
- No PHP linting available locally (same limitation as all PHP files here)
- Test suites unchanged (58/58 assertions passing) — new features exercise existing helpers only
- Live URL reflects all changes: https://etccapps.com/apps/carshow/

### Known issues / follow-ups

- **Memory notes created** for future sessions (stored in `C:\Users\Admin\.claude\projects\Z--Backup-Websites-CarShow\memory/`):
  - `feedback-tab-content-data-dependency.md` — guard tab builders with `if (state.result && state.result.ok)` before calling helpers that need registration data
  - `feedback-replace-all-scope-risk.md` — verify function definitions survive large find-and-replace operations; use `grep` after `replace_all` to confirm
  - Updated `feedback-tab-content-data-dependency.md` with bonus lesson about object literal trailing commas when removing properties
- **No automated UI tests for new features** — detail modal edits, email composer, T-Shirt Report all verified manually before deploy
- **First T-Shirt email send will only work if vendor email is configured** via Developer > Settings > T-Shirt Vendor
- **CC/BCC fields accept comma-separated addresses** — parser is simple (split on `,`, trim whitespace) with no validation for malformed emails

### Next session (superseded — see the two sections below for what actually happened)

## This session's work (Registration detail modal refactor, 2026-07-11, commit `17ec139`)

**User's request, verbatim:** "the alvin crown page does not need an edit button. it
should work just like the Edit Sponsor and have a save."

The Registration tab's detail modal (click any row) previously had a toggle: fields
were read-only until you clicked "✎ Edit", which then swapped `EDITABLE_FIELDS` columns
into inputs/selects and revealed Save/Cancel buttons. This was a different UX pattern
than the Sponsors tab's Edit Sponsor modal, which is always directly editable.

**Change:** removed the toggle entirely.
- `state.detailEditing` flag deleted; `openDetailEdit()`/`closeDetailEdit()` functions
  deleted (and their entries in the `window.__carshow` debug API).
- `detailFieldItem(r, c, fieldEls)` now always renders `EDITABLE_FIELDS` columns as
  inputs/selects — no `state.detailEditing &&` guard.
- `renderDetailModal()`: removed the "✎ Edit" button from the header entirely; Save/
  Cancel buttons are now always appended at the bottom of the modal body (previously
  only appended `if (editing)`).
- Added a **Delete** button (red/warn-colored) next to Save/Cancel, shown only for
  Walk-In rows (`r.id` present — CSV-derived rows don't support row-level delete from
  here, only via the Registration tab's checkbox/bulk-delete). New `deleteDetailRow()`
  function handles both the Walk-In (`removeWalkin`) and CSV-derived
  (`state.deletedCsvKeys` + `pushDeletedRegistrationsToServer`) cases, mirroring
  `deleteSelectedReg()`'s existing logic.
- Prev/Next navigation and Escape/Arrow-key keyboard shortcuts no longer have
  `!state.detailEditing` guards — they just always work now, since there's no separate
  edit mode to be "in".

Verified via a screenshot: the modal (e.g. clicking "Nisley, Steve") now shows every
field as an editable input by default, with Save/Cancel/Delete always visible — matching
the Edit Sponsor modal's shape exactly.

## This session's work (Sponsor Payments feature — full build + two critical bugfixes, 2026-07-11 to 2026-07-12, commits `7ecc591`..`6b77037`)

**This was an iterative, multi-round feature build driven by the user testing after each
deploy and reporting what still didn't work.** The two hardest bugs (API ReferenceError,
missing server persistence) were only found because the user kept re-testing and
reporting "no change" / "still not defaulting" rather than accepting a claimed fix — that
persistence is exactly why it took this many rounds and is worth understanding if a
similar "I fixed it but it's still broken" situation comes up again: **always ask whether
the fix was actually verified live, and if a fix looks correct in isolation but doesn't
change observed behavior, suspect something upstream is silently failing (a script
error, a no-op API call) rather than assuming the fix itself is wrong.**

### What was built (end state)

**Sponsors tab table** — four new payment columns, computed live from `state.payments`
via `getLastPaymentForSponsor(sponsorId)` (most recent payment by date):
- **Payment Date**, **Type** (Cash/Check/Credit Card), **Check #** (blank/`—` unless
  Check), **Amount** (currency-formatted via `fmtMoney`)

**Sponsors tab toolbar** — zoom controls (`−`/`+`/`Fit`/percentage label) identical in
behavior to the Registration tab's, but with independent state (`state.sponsorZoom`,
`setSponsorZoom()`, `fitSponsorZoom()`) so zooming one tab doesn't affect the other.

**Edit Sponsor modal** — a "Record Payment" section was added below the existing sponsor
fields (not a separate modal — see "Removed" below):
- **Payment Type** (select: Cash/Check/Credit Card), **Amount** (number input), **Date
  Received** (date input), **Check #** (text input, shown only when Type = Check)
- **Individual Sponsorship auto-default**: selecting "Individual" as Sponsor Type
  defaults Payment Type → Credit Card and Amount → 100. This applies **both** at modal-
  open time (if the sponsor's stored type is already "individual") **and reactively**
  when the Sponsor Type dropdown is changed after opening (a `change` listener on
  `typeSel` — this was the first of the two "still not defaulting" bugs, see below).
- **Pre-fill from actual payment record**: if the sponsor already has a payment (e.g.
  one created by backfill), the section pre-fills from `getLastPaymentForSponsor()`
  instead of showing generic defaults — so re-opening an already-recorded sponsor shows
  what was actually recorded, not blank/today's-date placeholders. New
  `dateInputValue(d)` helper converts any parseable date (including raw CSV strings like
  `"7/8/2026 7:55:00 AM"`) into the `YYYY-MM-DD` shape `<input type=date>` requires.
- **Reg Date** — added as a read-only display field (not editable) above Sponsor Type,
  using the same regDate-then-submittedAt fallback as the table's Reg Date column.
- Saving the sponsor now also records the payment (if Amount is filled in) in the same
  Save click — `upsertSponsor()` + a `recordPayment()` call, both fire-and-forget to the
  server.
- Autosave (1500ms debounce) added to both this modal and the Registration detail modal
  — edits save automatically after you stop typing, in addition to the explicit Save
  button.

**"+ Add Sponsor" external form** (`deploy/sponsor-form.php` — the actual destination of
the Sponsors tab's "+ Add Sponsor" button, a separate server-rendered page, NOT the
in-app modal) — payment fields were added here too, since this is genuinely where new
sponsors get created:
- Payment Type/Check#/Amount/Date Received fields, shown **only** when reached from
  inside the app (`?from=app` — the officer path). A member of the public who reaches
  this form from a link on ClubExpress/the club website never sees payment fields —
  asking a sponsor to self-report their own payment felt wrong, that's an officer/
  treasurer task.
- Same Credit Card/$100 default JS for Individual Sponsorship.
- On successful submit, if an amount was entered, a payment record is written
  **immediately** to `sponsor-payments.json` server-side (PHP, not a JS fetch) — no
  reliance on the backfill safety net for sponsors added this way.

**Backfill (for sponsors that predate or bypass the above)**:
- `backfillPaymentDefaults()` — for every Individual-type sponsor with no existing
  payment, creates one: Credit Card, $100, date = `sponsorRegDateForPayment(sponsor)`.
  Runs automatically: (a) once at page load inside `ingestPayments()`, (b) after every
  CSV (re)import inside `regenerate()` (right after `syncSponsorsFromRegistrations()`),
  and (c) inside `upsertSponsor()` — so a sponsor added/edited via the in-app modal or
  ingested from `sponsor-submissions.json` gets backfilled without waiting for a reload.
  Idempotent (no-ops for sponsors that already have a payment) so it's safe to call
  repeatedly.
- `backfillIndividualSponsorPayments()` — same logic, manually triggerable, exposed on
  `window.CarShow` for one-off console use: `CarShow.backfillIndividualSponsorPayments()`.
- `sponsorRegDateForPayment(sponsor)` — `sponsor.regDate` if present, else
  `fmtDate(sponsor.submittedAt)`. **This fallback was itself a bugfix** — sponsors added
  via the external `sponsor-form.php` (or in-app) only ever get `submittedAt`, never
  `regDate` (that field only exists on CSV-synced sponsors); the original backfill
  required `regDate` truthy and silently skipped everyone else, leaving test sponsors
  like "III"/"JJJ"/"KKK" with blank payment columns even though they were Individual
  type. Same fallback pattern `sponsorFieldText()`'s Reg Date column already used.

### Removed

- The standalone "💳 Record Payment" button + its modal (`renderPaymentModal`,
  `state.sponsorPaymentOpen`) were added early in this arc, then **removed** once payment
  recording was folded directly into the Edit Sponsor modal — recording a payment for an
  *existing* sponsor now happens by opening that sponsor's row and using the Record
  Payment section there, not a separate sponsor-picker modal. The modal's code
  (`renderPaymentModal`, `closePaymentModal`) is still in `app.js` but is currently
  unreachable from the UI — dead code that could be cleaned up in a future session if
  confirmed truly unused.

### Two critical bugs found and fixed

**Bug 1 — `ReferenceError: API is not defined`, silently breaking script execution
(commit `6b3e105`).** While exposing the debug hook as `window.CarShow` for console
access (`CarShow.backfillIndividualSponsorPayments()`), the code was written as
`window.__carshow = { ...bigobject... }; return (window.CarShow = API);` — but `API` was
never declared anywhere; the object literal was assigned directly to `window.__carshow`,
not to a local variable. This threw at the very end of the file's IIFE, **after**
`init()` had already run (so the page still rendered and looked fine), but it broke
`window.CarShow` entirely and meant every fix made *before* this one was diagnosed
appeared to have "no effect" — because the user's own verification step
(`CarShow.backfillIndividualSponsorPayments()` in the console) was itself broken by this
same error. **Fixed** by capturing the object correctly:
`var API = window.__carshow = { ... }`. **Lesson: when a fix reportedly "does nothing,"
check the browser console for unrelated errors before re-diagnosing the original fix.**

**Bug 2 — payments never actually persisted to the server (commit `6b77037`).** All the
`fetch(SITE_CONFIG.sponsorPaymentsApiUrl, ...)` calls throughout the payment code were
correctly written, but `sponsorPaymentsApiUrl` was **never added to `index.php`'s**
`window.__carshowSite` **injection**, and there was no `ingestPayments(...)` call in its
boot script at all, and no `sponsor-payments.php` endpoint existed on the server. Every
payment "recorded" during testing only ever lived in that browser tab's in-memory
`state.payments` — nothing was written to disk, and a page reload would have silently
lost it all. This was the real reason "backfill works" (visible within one session) but
"fields not defaulting when adding a sponsor" kept resurfacing — there was no
persistence layer at all. **Fixed** by:
- New `App/deploy/sponsor-payments.php` — `list`/`add` actions against
  `sponsor-payments.json`, mirroring `walkin-registrations.php`'s existing pattern
  exactly (same `carshow_authed()` dual auth, same lock-guarded read/write helpers from
  `lib.php`).
- `App/deploy/index.php` — added `sponsorPaymentsApiUrl: "sponsor-payments.php"` to the
  `window.__carshowSite` script, and a `window.__carshow.ingestPayments(...)` boot call
  reading `sponsor-payments.json`, positioned **right after** `ingestSponsors(...)` so
  `backfillPaymentDefaults()` (triggered inside `ingestPayments`) sees the real,
  already-populated sponsor list rather than an empty one.
- `App/deploy/.htaccess` — added a `<Files "sponsor-payments.json">` deny-all block,
  matching every other server-side JSON data file.
- `App/deploy/ftp-deploy.sh` — added `sponsor-payments.php` to the upload list.

### Testing performed

- `node test/run-tests.js` → **58/58 passing**, no regressions. The feature is UI-only
  (doesn't touch `logic.js`'s `generate()`), so no new fixture assertions were needed —
  `regression-tests.js`'s header comment was updated to document which UI-only features
  (payment modal/columns, zoom controls, autosave, always-editable detail modal,
  Individual Sponsorship backfill/defaults) are instead verified manually in the browser.
- No local PHP interpreter available — the three PHP files touched
  (`sponsor-payments.php`, `index.php`, `sponsor-form.php`) were reviewed by hand and
  brace/paren-balance-checked (`grep -c` counts matched), but never actually executed
  before deploy. **Not yet verified end-to-end live** — see the CRITICAL section's
  follow-up above; this is the top thing to check first in the next session if payments
  come up again.

### Files changed this arc

`App/src/app.js` (state, `SPONSOR_COLS`, `sponsorFieldText`, zoom fns, Edit Sponsor
modal payment section, backfill fns, `window.CarShow` fix, detail modal refactor),
`App/src/styles.css` (`.form-row .form-value` for the read-only Reg Date display),
`App/src/regression-tests.js` (header comment only), `App/deploy/index.php`,
`App/deploy/sponsor-form.php`, `App/deploy/.htaccess`, `App/deploy/ftp-deploy.sh`, new
`App/deploy/sponsor-payments.php`, plus the built `App/ETCCCarShow.html` and bumped
`App/version.json` after every JS change (final: v2.61).

## New Claude Code skills added this session

Two project-scoped skills were added to `.claude/skills/` (committed in `12177b1`):

- **`/CarShowBegin`** — reads this file and resumes development from where the last
  session left off. Body just forwards the instruction "Read
  `Z:\Backup\Websites\CarShow\PROJECT_STATUS.md` and continue development from where we
  left off."
- **`/CarShowEnd`** — updates this file with the session's work, written so a
  brand-new session can resume with no prior context (this is the skill that produced
  this very update — see `.claude/skills/CarShowEnd/SKILL.md`).

(A matching pair, `/SAMBegin`/`/SAMEnd`, was also added to the **sibling**
`SilentAuctionManager` repo at `Z:\Backup\Websites\SilentAuctionManager\.claude\skills\`
— different repo, different `PROJECT_STATUS.md`, not part of this project's history, but
worth knowing about if the user references "the SAM skills.")

### Next session

1. **Verify the Sponsor Payments feature live, end-to-end**, per the CRITICAL section's
   top follow-up: add an Individual sponsor via "+ Add Sponsor", confirm defaults, submit,
   confirm the Sponsors tab shows the payment, then **reload the page** and confirm it's
   still there (this last step specifically exercises the new server persistence and has
   not been tested since the fix landed).
2. Consider whether the now-unreachable `renderPaymentModal`/`state.sponsorPaymentOpen`
   dead code (see "Removed" above) should be deleted outright.
3. Git, the live site, and this doc are all in sync — no pending checkpoint. If new work
   starts, say **"checkpoint"** at natural stopping points to commit + push + deploy in
   one go (see `[[feedback-checkpoint-workflow]]` in Claude's memory).
