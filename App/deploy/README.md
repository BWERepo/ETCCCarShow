# Hostinger deployment

Live at **https://etccapps.com/apps/carshow/**, password-protected with a branded login
screen matching SilentAuctionManager's style (see memory: silentauctionmanager-pattern).

Note the `/apps/` prefix is required even though hPanel lists the FTP account's home
directory as `public_html/carshow` (no `apps/` segment) — there's a server-level Alias
mapping `/apps/carshow/` to that directory, matching the URL convention every other
sub-app on this domain uses. Bare `/carshow/` 404s for everything, including brand new
files, because it isn't a real path under the actual document root.

## Architecture: CODE vs DATA are deployed separately

This matters more than it sounds — get it backwards and you'll deploy code but wonder
why the data didn't update, or vice versa.

- **CODE** (`App/src/*` → `ETCCCarShow.html` → `app-bundle.html` on the server) changes
  only when you edit the app itself. Refreshed with `node build.js` + `ftp-deploy.sh`.
- **DATA** (registrations, sponsors) changes independently, any time an officer exports
  new CSVs or edits a sponsor. It lives in two gitignored JSON files on the server
  (`registrations-data.json`, `sponsor-submissions.json`) and is **never** touched by
  `ftp-deploy.sh`. `index.php` reads both fresh on every single page load and stitches
  them into the app bundle server-side — so a data refresh is live for the next visitor
  immediately, with no rebuild or redeploy of any kind.

This is what "always current" means here: everyone who loads the hosted page sees the
same, up-to-the-last-upload/edit data, because there is exactly one server-side copy of
each, not a snapshot baked in at some past deploy time.

## Layout

Server-side files (uploaded to the FTP account's home directory, which is already
scoped to `public_html/carshow` — check hPanel > Files > FTP Accounts if setting up a
new account):

- `index.php` — the gate **and** the live data-stitching template. Serves `_login.html`
  until a session is authenticated (checked via `secrets.php`'s password hash); once
  authenticated, reads `app-bundle.html`, injects the current
  `registrations-data.json` and `sponsor-submissions.json` as inline boot scripts
  (`window.__carshow.ingestRows(...)` / `.ingestSponsors(...)`), and serves the result.
  Nothing about the served HTML is pre-baked — it's assembled fresh per request.
- `lib.php` — shared helpers used by `index.php`, `sponsor-form.php`,
  `sponsor-submissions.php`, and `registrations-upload.php`: the dual auth check
  (`carshow_authed` — PHP session OR password), lock-guarded JSON read/write, and safe
  inline-`<script>` JSON encoding.
- `app-bundle.html` — **generated, not committed** — a plain copy of the built
  `App/ETCCCarShow.html`, uploaded by `ftp-deploy.sh`. Carries **no** baked-in data
  (unlike the old `_data.html`, which no longer exists in this flow) — `index.php`
  supplies data at request time instead.
- `_login.html` — the branded password screen (ETCC logo, purple gradient), with a
  "Forgot password?" link to `forgot-password.php`.
- `secrets.php` — **not committed, and no longer uploaded by `ftp-deploy.sh`** —
  defines `$PASSWORD_HASH`. Two ways to change it: use the "Forgot password?" flow
  below (which rewrites the live copy directly), or generate a hash locally
  (`openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'`, same template
  as `secrets.example.php`) and upload it by hand (see the comment in
  `ftp-deploy.sh`) — **do not** re-add it to the automatic upload list, or the next
  ordinary code deploy will silently revert any password set via the reset flow.
- `forgot-password.php` — **public, no login** — emails a time-limited (1 hour)
  reset link to a fixed admin address (hardcoded in the file, currently
  `etccwebsite.webmanager@gmail.com`), not to an address the visitor supplies. This
  site has one shared password, not per-user accounts, so there's no identity to
  check beyond "do you control that inbox" — which is a reasonable proxy here.
  Stores the token in `password-reset.json` (gitignored, blocked by `.htaccess`).
  Uses PHP's `mail()`; if delivery doesn't work on this host, fall back to the
  manual `secrets.php` method above.
- `reset-password.php` — validates the emailed token and lets you set a new
  password, writing a fresh hash straight into `secrets.php` on the server (not a
  file you get back — it never leaves the server). One-time use; the token is
  deleted after a successful reset or once it expires.
- `logout.php` — destroys the shared PHP session and redirects to the club's main
  site (`www.etccwebsite.com`). Linked from the app's hamburger menu (LIVE mode
  only, same visibility rule as the Member Database link).
- `.htaccess` — sets `DirectoryIndex index.php`, denies direct access to
  `sponsor-submissions.json`, `registrations-data.json`, `members-data.json`, and
  `password-reset.json`.
- `ETCClogoWhiteBackground.png` — logo; canonical copy lives at `../assets/` (shared
  with the main app, which embeds it as base64 in the header), originally copied from
  SilentAuctionManager's Images folder.
- `sponsor-form.php` — **password-gated, same shared password as `index.php`** — a
  standalone "Become a Sponsor" form with the same fields as the app's Sponsors tab.
  Meant to be linked/embedded from another website (e.g. the club's main site);
  officers hand the site password to sponsors/businesses that need to submit here.
  Serves the same `_login.html` screen as `index.php` (with a tweaked subtitle) until
  the shared session is authenticated, then appends each submission straight to
  `sponsor-submissions.json` — the single always-current sponsor list, not a separate
  staging area.
- `sponsor-submissions.php` — read/write JSON API for `sponsor-submissions.json`.
  `action=list` (default) returns the full list; `action=upsert` / `action=delete` add,
  edit, or remove one sponsor. Authenticated either by the existing PHP session (calls
  made from the hosted page itself — the normal case for the Sponsors tab's
  add/edit/delete) or by a password in the request body (calls with no shared session —
  the offline tool's cross-origin "Import from Server", which only ever uses
  `action=list`).
- `registrations-upload.php` — authenticated (same dual auth as above) endpoint that
  stores a fresh CSV pair as `registrations-data.json`. Called by
  `upload-registrations.js`, not by the browser app directly.
- `upload-registrations.js` — Node script: picks the newest exported CSVs from the
  Exports folder (or takes explicit paths) and POSTs them to
  `registrations-upload.php`. This is how a registration-data refresh reaches the
  hosted site — see below.
- `build-snapshot.js` — **deprecated for the live site**, kept only if you ever want a
  fully self-contained, portable single-file snapshot (e.g. to email someone without
  server access) with a specific day's data baked in. Not part of the normal refresh
  flow anymore; produces `_data.html` locally, which is not uploaded by
  `ftp-deploy.sh` and has no role in what `index.php` serves.
- `members-import.php` — **officer-only** (gated by the same PHP session as `index.php`
  — no separate password prompt, but you must already be logged in) page with a file
  upload form for an ETCC membership roster CSV (needs `last_name`/`first_name`
  columns — spacing/underscore/case-insensitive, so "Last Name" also works). Stores
  the parsed names as `members-data.json`. Linked directly from the app's hamburger
  menu (only shown when viewing the hosted site).

## Member roster validation on the sponsor form

The public form's "ETCC Member Name" field is a free-text input constrained by an HTML
`<datalist>` (autocomplete suggestions as you type a last name) built from
`members-data.json`, and validated server-side on submit: a non-empty value must match
a roster entry exactly (case-insensitively) or the submission is rejected with an error;
an empty value just means "not a sponsor who's also a member." Import/refresh the roster
via `members-import.php` whenever ETCC's membership list changes — there's no
auto-sync from ClubExpress for this (it's a manual CSV export/upload, same as
registrations).

## Sponsors: one always-current list

`sponsor-submissions.json` is both where the public form's submissions land AND what
the Sponsors tab reads/writes when viewed on the hosted site — there's exactly one
sponsor list, not a per-officer local cache that needs importing.

- **Sponsor form** (`sponsor-form.php`, gated by the same shared password as
  `index.php`) — appends a new sponsor.
- **Hosted Sponsors tab** — on page load, `index.php` injects the current list via
  `ingestSponsors()`; every add/edit/delete in the tab pushes immediately to
  `sponsor-submissions.php` (session-authenticated, no extra password prompt needed
  since you're already logged into the page). Every officer viewing the hosted site
  sees the same list, live.
- **Offline tool** (`ETCCCarShow.html`, opened locally) — unaffected by any of this. It
  still uses `localStorage` and the manual "Import from Server" pull, exactly as
  before, since it's a deliberately separate, private/offline experience (see
  `App/src/app.js`'s `LIVE` variable — it's only ever set when the page came from
  `index.php`).

No real-time sync between two officers editing at the same literal moment — last write
wins, and everyone else's view catches up on their next page load. Fine at this club's
scale; if that ever stops being true, that's the thing to revisit.

## Registrations: one always-current dataset

ClubExpress has no live API (see `AUTOPULL-NOTES.md`) — a person still has to trigger a
refresh by exporting CSVs. What's different from the old flow is where that data lands:

1. Export fresh CSVs (`/export-carshow-data` skill, or manually into the Exports folder).
2. `CARSHOW_SITE_PASSWORD=... node deploy/upload-registrations.js` — picks the newest
   CSVs automatically (or pass explicit paths), POSTs them to the live
   `registrations-upload.php`.
3. Done. The **very next** page load of the hosted site reflects the new data — no
   `build.js`, no `build-snapshot.js`, no `ftp-deploy.sh`.

`ftp-deploy.sh` / `app-bundle.html` are for **code** changes only (`App/src/*`); running
them has no effect on which registration data is being served.

## Deploying a code change

1. `node build.js` from `App/` — rebuilds `ETCCCarShow.html`.
2. Deploy with either:
   - `FTP_HOST=ftp.etccapps.com FTP_USER=u177039107.carshow FTP_PASS=... bash deploy/ftp-deploy.sh`, or
   - just `bash deploy/ftp-deploy.sh`, if you've created `deploy/.ftp-credentials`
     (copy `.ftp-credentials.example`, gitignored, same pattern as
     `../BusinessWebExpress/.ftp-credentials`) — no credentials on the command line
     at all in that case.

   Either way it uploads the bundle as `app-bundle.html`, plus `index.php`, `lib.php`,
   `sponsor-form.php`, `sponsor-submissions.php`, `registrations-upload.php`,
   `members-import.php`, `forgot-password.php`, `reset-password.php`, `_login.html`,
   the logo, and `.htaccess`. Never touches `secrets.php` (see above — deliberately
   excluded so it can't revert a live password reset), `registrations-data.json`,
   `sponsor-submissions.json`, `members-data.json`, or `password-reset.json`.

Dropping CSVs into the *offline* tool (`ETCCCarShow.html` run locally) never touches the
server either way — that's a fully separate, private experience by design.
