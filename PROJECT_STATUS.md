# ETCC Car Show App — Project Status

Last updated: 2026-07-08 (end of session, git commit `0e6e27c`, app version 1.11)

This file exists so a brand-new Claude Code session can pick up this project with no
prior conversation history. Read this fully before making changes.

## What this is

A single-page offline web app for East Tennessee Corvette Club (ETCC) officers to turn
two ClubExpress CSV exports (Registration Data, Activity Registrant Data) into a
searchable Registration table + Summary dashboard, matching/replacing an old
macro-driven `.xlsm` workbook. Everything runs client-side in the browser — CSVs are
parsed in JS, nothing is uploaded anywhere, by design.

There's also a second, related deployment: a **hosted snapshot** of that same app with
a specific day's CSV data already baked in, published to the club's Hostinger account
so someone without the app/CSVs can view the data behind a password. This is a
separate build artifact (`deploy/_data.html`) from the main offline tool
(`ETCCCarShow.html`), produced by a different script, sharing the same `src/` code.

## Repo / paths

- **Git repo root:** `Z:\Backup\Websites\CarShow` (this file's directory)
- **Remote:** `https://github.com/BWERepo/ETCCCarShow.git` — **this is a PUBLIC repo.**
  Never commit real credentials, password hashes, or files containing real member PII
  (`deploy/_data.html`, `deploy/secrets.php` — both gitignored, verify before any `git
  add -A`).
- **Branch:** `main`. Latest commit as of this doc: `0e6e27c`.
- **App source:** `App/` subdirectory (see layout below).
- **Sibling projects** (same `Websites\` parent, referenced for patterns):
  `Z:\Backup\Websites\SilentAuctionManager\` — see the memory note
  `silentauctionmanager-pattern` for why its login screen was used as this app's visual
  template, and why its *security model* (server-side check, not just a pretty login
  form) had to be replicated too, not just copied cosmetically.
- **Legacy tool (superseded, do not touch unless asked):** a macro-driven `.xlsm`
  workbook series at
  `Z:\Backup\ETCC\Document Library\Restricted\Events\Car Show\Spreadsheets\` — highest
  numbered file as of 2026-07-07 was `ETCCCarShow98.xlsm`. Kept for history only.
- **ClubExpress CSV exports** land in `Z:\Backup\ETCC\Car Show\Exports\`, pulled via the
  `/export-carshow-data` Claude Code skill (browser-automates the ClubExpress admin UI;
  see `AUTOPULL-NOTES.md` in `App/` for how/why).

## App directory layout (`App/`)

```
App/
  ETCCCarShow.html        # BUILT output — the single-file offline app. Don't hand-edit.
  build.js                # Builds ETCCCarShow.html from src/ + vendor/ + assets/
  version.json            # Auto-bumped by build.js each run (major.minor + lastBuilt)
  serve.js                # Zero-dep static file server for local preview (node serve.js [port])
  package.json            # deps: exceljs, jsdom, papaparse (devDependencies for tests/build)
  AUTOPULL-NOTES.md        # Why CSV export is browser-automation, not a real API

  src/                    # Hand-edited source, inlined into ETCCCarShow.html by build.js
    config.js              # Business rules: shirt buckets, status classification, etc.
    logic.js               # Pure generate(regRows, actRows, opts) -> result object
    excel.js               # Builds the "Download Excel" workbook from a generate() result
    regression-tests.js     # Shared assertions (see Testing section) — used by BOTH the
                             # Node CLI test and the in-app Settings "Run Regression Tests"
    app.js                 # DOM rendering, state, event wiring, hamburger/settings modal
    styles.css              # All CSS

  assets/
    ETCClogoWhiteBackground.png   # Canonical logo copy — build.js embeds as base64 in the
                                    # header; deploy/ftp-deploy.sh also uploads this same
                                    # file to Hostinger for the login screen's <img src>.

  test/
    run-tests.js            # Node CLI: `node test/run-tests.js` — logic + Excel round-trip
    dom-test.js              # Node CLI: `node test/dom-test.js` — full UI smoke test via jsdom
    fixtures/                # Frozen synthetic CSV fixture (fabricated data, NOT real
                              # members) — see comment in run-tests.js for the scenario.
                              # NEVER point either test at the live Exports folder — a real
                              # export overwrote these fixtures once already.

  vendor/                  # papaparse.min.js, exceljs.min.js — inlined by build.js

  deploy/                  # Hostinger deployment (separate artifact, see below)
    index.php               # PHP session gate — serves _login.html or _data.html
    _login.html              # Branded password screen (ETCC logo, purple gradient)
    _data.html               # GITIGNORED — generated snapshot with real CSV data baked in
    secrets.php               # GITIGNORED — defines $PASSWORD_HASH (SHA-512 crypt)
    secrets.example.php        # Committed template for secrets.php
    .htaccess                 # DirectoryIndex + denies direct access to _data.html
    build-snapshot.js          # Generates deploy/_data.html from the newest CSVs in Exports
    ftp-deploy.sh               # Repeatable FTP upload (env vars, see Deployment section)
    README.md                  # Deploy-specific docs (this file duplicates the essentials)
```

## Common commands

Run from `App/`:

- **Build the offline app:** `node build.js` → writes `ETCCCarShow.html`, bumps `version.json`
- **Run logic/Excel tests:** `node test/run-tests.js` (44 assertions as of this session)
- **Run full UI smoke test:** `node test/dom-test.js` (59 assertions as of this session)
- **Preview locally:** `node serve.js [port]` then open `http://localhost:<port>/` (defaults
  to port 5750; port 5750 was occupied by something else this session, 5799 was used
  instead — check what's free). A `.claude/launch.json` exists for the `preview_start`
  MCP tool with `name: "carshow-app"` on port 5799.
- **Rebuild the hosted snapshot:** `node deploy/build-snapshot.js` (auto-picks newest
  CSVs from the Exports folder, or pass explicit paths as argv)
- **Deploy to Hostinger:**
  `FTP_HOST=ftp.etccapps.com FTP_USER=u177039107.carshow FTP_PASS='...' bash deploy/ftp-deploy.sh`
  — **ask the user for FTP_PASS**; it is deliberately never written to any file in this
  repo or in Claude's memory system (see Credentials section below).

## ⚠️ Workflow rules (established this session, saved to Claude memory — follow these)

1. **Do not automatically run `node test/run-tests.js` or `node test/dom-test.js`** after
   making changes. The user runs tests manually — including via the in-app Settings →
   Run Regression Tests panel built specifically for this. Only run tests if explicitly
   asked ("run the tests", "does this pass").
2. **Do not automatically `git add`/`commit`/`push`, and do not automatically run the FTP
   deploy script.** Make and build changes locally, describe what changed, then STOP.
   Only commit/push/deploy when the user explicitly says **"checkpoint"** (treat commit +
   push + FTP deploy as one bundled action) or otherwise explicitly names one of those
   actions ("deploy", "commit and push").
3. Still **do** rebuild locally (`node build.js`, `node deploy/build-snapshot.js`) and
   visually verify UI changes via the preview browser tools before reporting a change
   done — building and previewing are not "testing" or "deploying" in the sense of rule
   1/2 above.

Full detail: Claude memory file `feedback-carshow-workflow.md` for this project.

## Deployment / hosting details

- **Live URL:** `https://etccapps.com/apps/carshow/` — note the `/apps/` prefix is
  **required** even though Hostinger's hPanel lists the FTP account's home directory as
  `public_html/carshow` (no `apps/` segment). There's a server-level Alias (invisible to
  us — outside anything in `.htaccess`, and our FTP account can't browse above its own
  home directory to find it) mapping `/apps/carshow/` to that directory, matching the
  URL convention used by this domain's other sub-apps (`/apps/sam/`, `/apps/dashboard/`).
  Bare `/carshow/` (no `/apps/`) 404s for **everything** in that directory, including
  files uploaded seconds earlier — this was a multi-hour debugging detour this session;
  don't repeat it.
- **FTP:** host `ftp.etccapps.com`, account `u177039107.carshow`. FTPS (encrypted)
  fails certificate hostname validation (`SEC_E_WRONG_PRINCIPAL`) — `curl` needs `-k` to
  skip verification (channel is still encrypted, just not identity-checked). The user
  explicitly authorized this bypass this session; if a future session hits the same
  error, ask again rather than assuming.
- **Site login:** username `ETCC`, password — **ask the user**. This is a real,
  currently-active password protecting real member PII (names, emails, phones,
  addresses); it is deliberately not stored in this file, in git, or in Claude's memory
  system. It's checked server-side in `deploy/secrets.php` (gitignored) via a SHA-512
  crypt hash, generated with:
  `openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'`
  (PHP's `crypt()` verifies `$6$` hashes natively — this works without needing PHP
  installed locally, which this dev machine doesn't have).
- **Security model:** `index.php` is a real server-side gate (PHP session,
  `$_SESSION['carshow_authenticated']`) — not a cosmetic JS-only password box. The
  actual data file `_data.html` is blocked from direct HTTP access by `.htaccess`
  (`<Files "_data.html"> Require all denied`) and is only ever read via PHP's
  `readfile()` after a verified session. This was a deliberate choice after
  establishing that a client-side-only gate would ship the real PII to the browser on
  page load regardless of the password box (see memory: `silentauctionmanager-pattern`).
- **Explicit no-cache headers** are sent from `index.php`
  (`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` + `Pragma: no-cache`)
  because PHP's default session cache limiter wasn't preventing stale
  browser-cached content on this host — hit this twice before adding the explicit
  headers (a subtitle-text fix not showing up, and what first looked like the
  directory-routing bug above but was actually just cache).
- **"CSVs loaded:" timestamp**: reflects the *export file's modification time*
  (`fs.statSync(...).mtimeMs`, the newer of the two CSVs), captured at
  `build-snapshot.js` build time and passed through to `ingestRows(reg, act,
  generatedAt)`. It does **not** reflect page-load time — that was a bug fixed this
  session (previously showed whatever moment a visitor happened to open the page,
  since the boot script re-ingests on every page view).
- **Refresh cycle for new data:** export fresh CSVs → `node build.js` (if `src/`
  changed) → `node deploy/build-snapshot.js` → `bash deploy/ftp-deploy.sh` with the FTP
  env vars. Dropping different CSVs into the *live* page itself does **not** update the
  server for other visitors — the app is client-side for that interaction.

## This session's work (chronological)

Starting point: app already existed (commit `bb5c2d1`) with Registration/Summary tabs,
Excel export, the export-carshow-data automation skill, and the offline
drag-and-drop-CSVs workflow. This session added:

1. **Data sharing exploration** — considered emailing a zip of the app + CSVs (manual
   drag-drop by recipient), then a self-contained "snapshot" build embedding CSV data
   directly into the HTML via an injected boot script calling
   `window.__carshow.ingestRows()`. This snapshot pattern became `deploy/build-snapshot.js`.
2. **Hostinger deployment built from scratch** (`b14f08d` and follow-ups) — FTP
   upload pipeline, PHP session-based password gate modeled on SilentAuctionManager's
   real security pattern (not just its look), `.htaccess` blocking direct access to the
   real data file, `secrets.php`/`secrets.example.php` split so the real password hash
   never reaches the public git repo.
3. Footer copyright line added (`3f1e1d3`).
4. **Live-URL bug hunt** — spent significant effort discovering the `/apps/` prefix
   requirement (see Deployment section above); fixed docs (`5205602`).
5. Fixed the hosted snapshot's misleading "Offline tool" subtitle (`d7aff02`) and added
   explicit no-cache headers after hitting stale-cache confusion twice (`d39782b`).
6. **Default filters changed:** status filter defaults to Paid-only (`0471116`), and
   walk-ins default to hidden (part of `beb28d5`) — both to declutter the initial view.
7. **Hamburger menu + Settings panel** (`bfb874f`) — new `src/regression-tests.js`
   module shares fixture-based assertions between the Node CLI (`test/run-tests.js`,
   refactored to source from it) and an in-browser "Run Regression Tests" button with an
   "only show errors" filter checkbox. Fixture CSVs are embedded into the built HTML via
   `build.js` for the in-app runner. Running tests in-app never touches whatever real
   CSVs the user currently has loaded (verified in `dom-test.js`).
8. **ETCC logo added to header** (`beb28d5`), then **doubled in size to 72×72px**, then
   the whole header **redesigned**: centered content, black text, red gradient banner
   removed entirely, subtle bottom border, hamburger menu repositioned to absolute
   top-right (`b78835b`) since centering broke the old flex-spacer trick.
9. **CSVs-loaded timestamp bug fixed** and **redundant "Shirt Selection" detail-modal
   section removed** (`0e6e27c`, latest commit) — see Deployment section for the
   timestamp fix detail.

All of the above is committed, pushed to `main`, and deployed live as of `0e6e27c`.

## Testing

- `test/run-tests.js` (44 assertions) — pure logic + Excel export round-trip against
  `test/fixtures/*.csv`, via `src/regression-tests.js`'s `assertionList()` /
  `excelAssertionList()`.
- `test/dom-test.js` (59 assertions) — full jsdom UI smoke test: table rendering,
  search/filters, detail modal, print view, zoom, summary tab, AND the hamburger menu /
  Settings / in-app regression test runner.
- Both suites passed clean at the end of this session. Per the workflow rules above,
  don't run them proactively — the user will run them, including via the in-app panel.

## Known follow-ups / things a new session might need to know

- No open bugs as of this doc's writing.
- If FTP or the site login stops working, the FTP password and site password are not
  recoverable from any file — ask the user.
- If `/apps/carshow/` starts 404ing again, re-read the Deployment section above before
  spending time debugging — this exact failure mode already ate significant session
  time once (turned out to be the `/apps/` prefix, not caching or `.htaccess`).
- `deploy/_data.html` is a generated artifact (gitignored) — always rebuild it via
  `node deploy/build-snapshot.js` rather than assuming it's current; it embeds whatever
  CSVs were newest in the Exports folder at build time.
