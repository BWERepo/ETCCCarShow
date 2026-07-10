# ETCC Car Show App — Project Status

Last updated: 2026-07-10 (session in progress — latest committed hash `20e74a2`).
**Git and the live site were brought back in sync this session** — commit `20e74a2`
(covering the "+ Add Registration"/Walk-In feature and everything through the test-suite
overhaul below) was committed, pushed, and is live. Since that checkpoint: a small
`CSSponsorName`→Individual Sponsorship Text CSV mapping was implemented, tested ("test"),
and deployed via `ftp-deploy.sh`, then folded into that same `20e74a2` commit before it
was pushed — so git and live are **fully in sync as of `20e74a2`**. Most recently, a new
**Paid Registrations API** feature (external read-only endpoint + Developer > 🔌 API
screen) was implemented and built but is **not yet deployed or committed** — see "This
session's work (Paid Registrations API...)" below. Say "checkpoint" to commit it, "ftp"
to deploy it (or both).

This file exists so a brand-new Claude Code session can pick up this project with no
prior conversation history. Read this fully before making changes. Previous revisions
(ending at commits `a06df91`/v1.20 and `7e66bf8`/v1.38) are in git history if you need
older context. This revision covers the session span from v1.43 to present. Earlier in
this span: a major refactor removing the offline/standalone tool entirely (the codebase
supports one deployment only — the hosted site) and a Shirts-column row-height fix, both
committed/deployed. Most recently, **six major uncommitted-but-deployed rounds** building
on a new "+ Add Registration" (Walk-In Member/Nonmember) feature: **(1)** the feature
itself; **(2)** member-lookup autofill + Developer > Settings screen (walk-in numbering
+ registration fees); **(3)** extending lookup to Corvette Year/Model/Color + Club Name,
fixing hyphenated-header email-lookup bug, adding checkbox/bulk-delete to Registration
tab (CSV rows too); **(4)** reworking Add Registration form's fee logic to key off "In
Car Show?" instead of separate Registration Type field; **(5)** email-import alias fix
(`primary_email`); **(6)** test-suite overhaul, dom-test.js deletion, editable detail-
modal fields (all rows), and Individual Sponsorship Text + Spouse First Name auto-default
columns. See "This session's work" for a comprehensive breakdown.

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
- **Branch:** `main`. Latest commit as of this doc: `7e66bf8`.
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

## **CRITICAL: Current Deployment State**

**Git and the live site are in sync at commit `20e74a2`.** That checkpoint covers
everything through the test-suite overhaul and the `CSSponsorName` mapping (both
committed, pushed to `origin/main`, and deployed via `ftp-deploy.sh` in the same
session).

**Since `20e74a2`, one new feature is implemented + built locally but NOT yet deployed
or committed:** the **Paid Registrations API** (external read-only endpoint at
`paid-registrations-api.php?key=...`, plus a new Developer > 🔌 API screen to
show/test/rotate the key) — see "This session's work (Paid Registrations API...)"
above for the full breakdown. New/changed files: `App/src/app.js`, `App/src/styles.css`,
`App/deploy/index.php`, `App/deploy/app-settings.php`, `App/deploy/.htaccess`,
`App/deploy/ftp-deploy.sh`, `App/deploy/README.md`, plus two new PHP files
(`App/deploy/paid-registrations-cache.php`, `App/deploy/paid-registrations-api.php`)
and the rebuilt `App/ETCCCarShow.html`.

### Next session: say "checkpoint" to commit, "ftp" to deploy (or both) the Paid
Registrations API work above. If the user asks for a brand-new feature instead, mention
this one round is still uncommitted/undeployed and ask whether they want it
checkpointed first (most likely yes, to avoid losing work).
