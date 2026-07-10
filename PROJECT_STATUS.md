# ETCC Car Show App — Project Status

Last updated: 2026-07-10 (end of session, git commit `7e66bf8`, app version 1.38)

This file exists so a brand-new Claude Code session can pick up this project with no
prior conversation history. Read this fully before making changes. (The previous
revision of this file, covering the session that ended at commit `a06df91`/v1.20, is
still in git history if you need that context — this revision supersedes it.)

## What this is

A web app for East Tennessee Corvette Club (ETCC) officers to turn ClubExpress CSV
exports into a searchable Registration table, a Summary dashboard, and a Sponsors
tracker — matching/replacing an old macro-driven `.xlsm` workbook. It exists in **two
very different deployments that share the same `src/` code**:

1. **The offline tool** (`App/ETCCCarShow.html`) — a single self-contained HTML file
   you open locally (double-click, or a local dev server) and drag the two CSVs onto.
   Everything runs client-side; nothing is uploaded anywhere, by design. Sponsors are
   stored in the browser's `localStorage`. This is the original, private/offline
   experience.
2. **The hosted site** (`https://etccapps.com/apps/carshow/`) — password-protected,
   fully live/dynamic: registrations, sponsors, and the member roster all live as JSON
   files on the server and are read fresh on every page load. This session added a
   second password-gated public entry point (`sponsor-form.php`) and two more
   browser-based officer tools (`registrations-import.php`, `logout.php`) — see below.

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
  ETCCCarShow.html        # BUILT output — the offline app AND the template the hosted
                            # site's index.php stitches live data into (as app-bundle.html
                            # on the server — see Deployment). Don't hand-edit.
  build.js                # Builds ETCCCarShow.html from src/ + vendor/ + assets/
  version.json            # Auto-bumped by build.js each run (major.minor + lastBuilt)
  serve.js                # Zero-dep static file server for local preview (node serve.js [port])
  package.json            # deps: exceljs, jsdom, papaparse (devDependencies for tests/build)
  AUTOPULL-NOTES.md        # Why CSV export is browser-automation, not a real API
  tools/check-csvs.js      # Ad-hoc sanity check against a real (non-fixture) CSV pair —
                            # not part of the automated suite; predates this session.

  src/                    # Hand-edited source, inlined into ETCCCarShow.html by build.js
    config.js              # Business rules: shirt buckets, status classification,
                             # SPONSOR_TYPES, SPONSOR_SHIRT_SIZES/SPONSOR_SIZE_INDEX
    logic.js               # Pure generate(regRows, actRows, opts) -> result object.
                             # Also captures rec._sponsorShirtSize (per-registrant Individual
                             # Sponsorship bonus-shirt size) for the app's CSV-sponsor sync.
    excel.js               # Builds the "Download Excel" workbook, incl. a SponsorsSheet
                             # (its own SPONSOR_COLS — NOT the same array as app.js's; if
                             # you add a column to one, check whether the other needs it too)
    regression-tests.js     # Shared assertions (see Testing) — used by BOTH the Node CLI
                             # test and the in-app Settings "Run Regression Tests"
    app.js                 # DOM rendering, state, event wiring, hamburger/settings modal,
                             # Sponsors tab (local + LIVE modes), CSV->Sponsors auto-sync,
                             # LIVE-mode detection (window.__carshowLive) — see this
                             # session's substantial changes below
    styles.css              # All CSS, incl. the new off-canvas nav drawer this session

  assets/
    ETCClogoWhiteBackground.png   # Canonical logo copy — build.js embeds as base64 in the
                                    # header; deploy/ftp-deploy.sh also uploads this same
                                    # file to Hostinger for the login screen's <img src>.

  test/
    run-tests.js            # Node CLI: `node test/run-tests.js` — logic + Excel round-trip
    dom-test.js              # Node CLI: `node test/dom-test.js` — full UI smoke test via jsdom
    fixtures/                # Frozen synthetic CSV fixture (fabricated data, NOT real
                              # members) — NEVER point either test at the live Exports folder.

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
    logout.php                  # NEW this session — destroys the shared PHP session and
                              # redirects to the club's main site
                              # (https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652).
                              # Linked from the hamburger menu (LIVE mode only).
    forgot-password.php        # PUBLIC — "Forgot password?" link target. Emails a
                              # time-limited token to a FIXED admin address via
                              # carshow_send_mail(). Stores the token in password-reset.json.
    reset-password.php         # Validates the emailed token, lets you set a new password,
                              # rewrites secrets.php — PRESERVING any existing $SMTP_* fields.
    .htaccess                  # Denies direct access to every *.json data file
    .ftp-credentials.example   # Committed template for .ftp-credentials
    .ftp-credentials            # GITIGNORED — real FTP host/user/pass, read at runtime by
                              # ftp-deploy.sh if present.
    ftp-deploy.sh               # Uploads CODE only. Now also uploads registrations-import.php
                              # and logout.php (added to the list this session). Deliberately
                              # does NOT upload secrets.php or any *-data.json file.
    build-snapshot.js          # DEPRECATED for the live site — kept only for producing a
                              # portable single-file snapshot to email someone without
                              # server access.
    README.md                  # Deploy-specific docs, kept up to date throughout this
                              # session — the most detailed reference for hamburger-menu
                              # behavior, the sponsor-form gate, and registrations-import.php.
```

## Common commands

Run from `App/`:

- **Build the offline app:** `node build.js` → writes `ETCCCarShow.html`, bumps `version.json`
- **Run logic/Excel tests:** `node test/run-tests.js` (44 assertions)
- **Run full UI smoke test:** `node test/dom-test.js` (59 assertions)
- **Preview locally:** `node serve.js [port]` then open `http://localhost:<port>/`. A
  `.claude/launch.json` exists for the `preview_start` MCP tool (`name: "carshow-app"`,
  port 5799). **Per this project's workflow rules below, don't use the Claude Preview
  tools or self-verify unless the user explicitly asks.**
- **Refresh the LIVE site's registration data** — now two ways:
  - CLI: `CARSHOW_SITE_PASSWORD=... node deploy/upload-registrations.js`
  - Browser (new this session): hosted site → hamburger → Developer (site password) →
    Import Registrations → `registrations-import.php`, pick the two CSVs, submit.
- **Refresh the LIVE site's member roster:** hamburger → Developer → Import Members →
  `members-import.php` (unchanged this session except its menu location moved).
- **Deploy a code change:** `node build.js` then `bash deploy/ftp-deploy.sh` (reads
  credentials from `deploy/.ftp-credentials` automatically if present).
- **Manually push `secrets.php`:** see the one-off `curl` command documented in
  `ftp-deploy.sh`'s comments and `deploy/README.md`.

## ⚠️ Workflow rules (established across sessions, saved to Claude memory — follow these)

1. **Do not automatically run `node test/run-tests.js` or `node test/dom-test.js`**
   after making changes. Only run tests if explicitly asked ("run the tests", "test",
   "does this pass"). This session, the user said a bare **"test"** — that alone was
   sufficient to run both suites; treat that single word as the explicit ask.
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
  Sponsor were removed from this menu entirely this session (Settings still exists for
  the offline tool, which has no Logout/Developer equivalent).
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

## Testing

- `test/run-tests.js` (44 assertions) — pure logic + Excel export round-trip.
  **Unaffected by this session's changes** (still passed clean when run).
- `test/dom-test.js` (59 assertions) — full jsdom UI smoke test. **Required two fixes
  this session**, both to keep pace with intentional UI changes, not regressions:
  (1) the Shirts-panel selector (looked for an `h3` "Shirts", which the Reg-Date/
  shirt-matrix work removed — see commit `852800b`); (2) the hamburger menu-state
  assertions, changed from checking a `.hidden` class to checking the new `.open`
  class after the off-canvas drawer redesign (commit `d3d6176`).
- Both suites were run explicitly (user said **"test"**) after fix (1) and passed
  clean, 44/44 and 59/59. **Fix (2) and the row-height CSS fix (`7e66bf8`) were made
  *after* that test run and have NOT been re-verified by an actual suite run** — the
  `dom-test.js` edits for fix (2) look correct by inspection (mirrors fix (1)'s
  pattern exactly) but a future session should run `node test/dom-test.js` once to
  confirm, especially before making further hamburger-menu changes.
- The Sponsors tab's checkbox/bulk-delete UI, the LIVE-mode server sync, the
  Developer password gate, and all the PHP endpoints (including the two new ones,
  `registrations-import.php` and `logout.php`) have **no automated test coverage** —
  verified only by manual review (no local PHP interpreter available) and the
  deploys/checkpoints during this session.

## Known follow-ups / things a new session might need to know

- **No open bugs** as of this doc's writing. The Reg Date backfill bug and the
  edit-modal field-dropping bug (both found and fixed this session) are resolved.
- **Run `node test/dom-test.js` once** before extending the hamburger menu or Sponsors
  tab further — see Testing above for exactly what's unverified and why.
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
