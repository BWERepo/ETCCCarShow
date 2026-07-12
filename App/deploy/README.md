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
  site (`www.etccwebsite.com`). Linked from the app's hamburger menu.
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
  edit, or remove one sponsor; `action=clear` removes all. Authenticated by the
  existing PHP session — calls made from the hosted page itself, the normal case for
  the Sponsors tab's add/edit/delete/clear.
- `registrations-upload.php` — authenticated (same dual auth as above) endpoint that
  stores a fresh CSV pair as `registrations-data.json`. Called by
  `upload-registrations.js`, not by the browser app directly.
- `upload-registrations.js` — Node script: picks the newest exported CSVs from the
  Exports folder (or takes explicit paths) and POSTs them to
  `registrations-upload.php`. This is how a registration-data refresh reaches the
  hosted site — see below.
- `members-import.php` — **officer-only** (gated by the same PHP session as `index.php`
  — no separate password prompt, but you must already be logged in) page with a file
  upload form for an ETCC membership roster CSV (needs `last_name`/`first_name`
  columns — spacing/underscore/case-insensitive, so "Last Name" also works). Stores
  the parsed names as `members-data.json`. Linked from the hamburger menu's
  password-gated "Developer" submenu (see below).
- `registrations-import.php` — **officer-only**, same session gate as
  `members-import.php` — a browser-based sibling of `registrations-upload.php`: pick a
  Registration Data CSV (required) and Activity Registrant Data CSV (optional), submit,
  and it writes `registrations-data.json` directly (same shape/destination as the CLI
  upload flow). Exists so a data refresh doesn't require running
  `upload-registrations.js` from a terminal. Also linked from the hamburger's
  "Developer" submenu.

## Hamburger menu

Order: **Logout**, **Developer** (password-gated — reveals **Import Members**,
**Import Registrations**, **Run Regression Tests**, and **Change Log** once unlocked).

"Developer" is a client-side password gate, not a separate account or secret — clicking
it expands an inline password field in the menu that POSTs to `location.pathname` with
the same `action=login` request `_login.html` uses (checked against `secrets.php`'s
`$PASSWORD_HASH`, same as the main login). Getting it right reveals **Import Members**
and **Import Registrations** (linking to `members-import.php` and
`registrations-import.php` — both already independently session-gated server-side
regardless of this UI step), plus **Run Regression Tests** and **Change Log**, which
open in-page (Settings' regression-test runner and a GitHub-commit-history view — see
`App/src/app.js`). The point of "Developer" is to keep these links out of the way for
everyday use, not to add a second real credential.

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
  `index.php`) — appends a new sponsor. Where both Submit and Cancel send them
  afterward depends on a hidden `from` field: the Sponsors tab's "+ Add Sponsor" button
  opens this form with `?from=app`, and from there both a successful submit and Cancel
  redirect back to `index.php#sponsors` (a fresh page load — Submit's landing on a
  Sponsors tab that already shows the new entry). Reached any other way (e.g. a link on
  ClubExpress/the club's main site, with no `from=app`) both instead redirect to
  `https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652`, since an outside
  sponsor/business has no reason to land inside the internal app either way.
- **Hosted Sponsors tab** — on page load, `index.php` injects the current list via
  `ingestSponsors()`; every add/edit/delete in the tab pushes immediately to
  `sponsor-submissions.php` (session-authenticated, no extra password prompt needed
  since you're already logged into the page). Every officer viewing the hosted site
  sees the same list, live.

No real-time sync between two officers editing at the same literal moment — last write
wins, and everyone else's view catches up on their next page load. Fine at this club's
scale; if that ever stops being true, that's the thing to revisit.

## Registrations: one always-current dataset

ClubExpress has no live API (see `AUTOPULL-NOTES.md`) — a person still has to trigger a
refresh by exporting CSVs. What's different from the old flow is where that data lands:

1. Export fresh CSVs (`/CarShowGetRegistrations` skill, or manually into the Exports folder).
2. Either:
   - `CARSHOW_SITE_PASSWORD=... node deploy/upload-registrations.js` — picks the newest
     CSVs automatically (or pass explicit paths), POSTs them to the live
     `registrations-upload.php`; or
   - hamburger menu → Developer (site password) → Import Registrations →
     `registrations-import.php`, and pick the two files by hand in the browser.
3. Done. The **very next** page load of the hosted site reflects the new data — no
   `build.js`, no `ftp-deploy.sh`.

`ftp-deploy.sh` / `app-bundle.html` are for **code** changes only (`App/src/*`); running
them has no effect on which registration data is being served.

## Walk-In registrations: a second, independent always-current list

`walkin-registrations.json` holds manually-added Walk-In Member/Nonmember rows entered
through the Registration tab's "+ Add Registration" form — for someone who shows up at
the event without having pre-registered online. It's a separate file from
`registrations-data.json` (and untouched by CSV imports) for the same reason
`sponsor-submissions.json` is separate: officer-entered data needs to survive the *next*
CSV re-import, not get wiped by it.

- **Add Registration form** — picks Walk-In Member (officer types the real member
  number, or looks it up by name from the imported roster — see below) or Walk-In
  Nonmember (auto-assigned the next open number from a numbering pool that's
  deliberately separate from the CSV import's own nonmember numbers — see app.js's
  `nextAvailableWalkinNumber()` and "Settings" below). Every add pushes immediately to
  `walkin-registrations.php` (session-authenticated).
- **On page load**, `index.php` injects the current list via `ingestWalkins()`; app.js's
  `allRegistrations()` merges it with the CSV-derived rows everywhere the Registration
  and Summary tabs read registrations from (table, search, sort, print, live totals,
  shirt counts) — a walk-in behaves identically to a CSV row except persistence.
- **Editing a Walk-In row** — the detail modal's Edit mode (see "Editable detail modal
  fields" below) is the correction path now. The dedicated "Delete Walk-In Registration"
  button that used to live in the detail modal was removed once bulk-delete + editing
  both existed — a wrong Reg Type or a "I want to start over" case still goes through the
  Registration tab's checkbox/bulk-delete + re-adding instead.

## Editable detail modal fields

Clicking a row's "✎ Edit" button (in the detail modal's head) switches every
`EDITABLE_FIELDS` row from plain text to an `<input>`/`<select>`, Save/Cancel buttons
appear, and Prev/Next + click-outside-to-close are disabled until you leave edit mode
(Save, Cancel, or Escape — which acts as Cancel while editing) — so an in-progress edit
can't be silently discarded by an accidental click or arrow key. Applies to **every**
row, CSV-imported or Walk-In, per the user's explicit choice (matching the bulk-delete
scope decision):

- **Editable:** Reg #, Club Name, Status, Total Fee, Individual Sponsorship,
  Spouse First Name, #, Phone, Email, Address, City, State, Zip, Year, Model, Color,
  In Car Show?. (Ind. Spon. Text is **not** shown/editable here — see below.)
- **Not editable:** Reg Date, Reg Type, Gen (system/derived — Gen auto-recomputes from
  Year if Year changes, see `applyRecordPatch()`), and the Shirts section (a 24-bucket
  editor is a separate, bigger task).
- **Status** is a free-form CSV field in practice (ClubExpress uses values like "Not paid
  in time limit" or "Open", not just Paid/Not Paid/Cancelled) — the select preserves
  whatever the row's current value already is as an extra option, so saving an edit to
  an unrelated field can't silently downgrade an unusual Status to the nearest of the
  three standard choices.
- **Walk-In rows** already have a full server record (`walkin-registrations.json`) — an
  edit just merges the patch and re-pushes it via the same `upsertWalkin()` the Add
  Registration form uses.
- **CSV-imported rows** have no per-row server record — `registrations-data.json` is
  wholly replaced by every fresh import. An edit is stored as a **patch**, keyed by the
  row's stable identity (`csvRegKey()`, the same Reg-Date+name identity bulk-delete
  uses), in a new `registration-overrides.json` (via `registration-overrides.php`,
  action=list/upsert). `regenerate()` re-applies every stored patch on top of the
  freshly-parsed CSV every page load — including after a **later** re-import that still
  contains the same row, so the edit survives indefinitely, same durability guarantee as
  a CSV-row deletion. Each save fully replaces that row's stored patch (the form always
  submits every editable field together, not a partial diff).

## Ind. Spon. Text (and Spouse First Name)

Spouse First Name is a `baseColumnOrder` (`config.js`) column with **no ClubExpress
CSV source at all** — confirmed by checking a real, current registration export's
headers, not guessed. Starts blank on every fresh CSV row; only settable by hand via
the detail modal's Edit mode.

**Ind. Spon. Text is deliberately NOT a `baseColumnOrder` column** — removed from the
Registration tab/detail modal/Excel export at the user's request, since it's no longer
shown there. It's still computed on every record, though: `logic.js`'s
`sponsorshipDefaultText()`/`applySponsorshipTextDefault()` auto-defaults it to
`"First [and Spouse First] Last"` (e.g. "John Smith" or "John and Jane Smith") the
moment Individual Sponsorship is > 0 and it's still blank, and `generate()` also sets
it directly from the CSV's `CSSponsorName` activity column when present (see
`config.js`'s `sponsorNameColumn`). `blankRecord()` initializes it to `""` on every
record even though it's not in `columns`, so it behaves consistently whether or not
anything ends up setting it. The only consumer left is
`syncSponsorsFromRegistrations()` (`app.js`), which reads a registration's
`rec["Ind. Spon. Text"]` once to seed the Sponsors tab's own **Ind. Spon. Text**
column (a real, editable, insert-only field on the sponsor record from then on — see
"Sponsors: one always-current list" above) — it is otherwise invisible anywhere in
the app.
- **Spouse First Name** — purely a manual-entry field (via the detail modal's Edit mode);
  nothing currently populates it automatically. Exists so an officer can supply a
  sponsor's plus-one name, making the "and Spouse" branch above actually fire.
- **Not added to the Add Registration form** — a Walk-In registration has no Individual
  Sponsorship concept in that form today (it's a real ClubExpress-only activity type),
  so this was left out of scope. Both fields are still reachable for a Walk-In via the
  detail modal after the fact, same as any other editable field.

## Member roster: name lookup, member numbers, and contact info

`members-data.json` (Developer → Import Members → `members-import.php`) started out
holding only `{name, lastName, firstName}` — enough for `sponsor-form.php`'s "ETCC
Member Name" datalist/validation. It now also captures whichever of `memberNumber`,
`phone`, `email`, `address`, `city`, `state`, `zip`, `year`, `model`, `color`,
`spouseFirstName` the imported CSV has recognizable columns for (`Member Number`/`Member
No`/`Member #`/`Member ID`/`ID`, `Phone`, `Email`, `Address`, `City`, `State`, `Zip`,
`Year`/`Corvette Year`, `Model`/`Corvette Model`, `Color`/`Corvette Color`, `Spouse First
Name`/`Spouse`/`Spouse Name` — same normalized, case/space/underscore-insensitive
matching last/first name already used). Any field the CSV doesn't have a column for is
just `""` for every record — harmless, that field falls through to manual entry.
**Note:** this only takes effect from the *next* re-import — code changes here don't
retroactively add fields to whatever's already sitting in `members-data.json` on the
server, so re-import after any code change that touches this file's column detection.

- **On page load**, `index.php` injects the roster via `ingestMembers()` (`state.members`).
- **Add Registration form** — when Reg Type is Walk-In Member, a "Look Up Member" field
  (a `<datalist>` of `"Last, First"` names, same pattern as the sponsor form's member
  field) auto-fills the *whole form* on an exact match — Last Name, First Name, Reg
  Number, Phone, Email, Address, City, State, Zip, Corvette Year, Model, Color from that
  roster entry, plus Club Name unconditionally set to `"ETCC"` (every roster entry is, by
  definition, an ETCC member — not itself a roster field). Still just a convenience —
  every field stays manually editable, and fields the roster doesn't have data for are
  simply left as whatever was already typed. (No Spouse First Name field on this form
  today — a Walk-In's spouse name, if needed, is still only settable via the detail
  modal afterward.)
- **CSV-imported registrations** — `regenerate()` (`app.js`) backfills a blank Spouse
  First Name from the roster too, matching by Reg # against the roster's own
  `memberNumber`. ClubExpress's own registration/activity export has **no** spouse
  column at all (confirmed — neither file's header has anything resembling one), so this
  roster cross-reference is the only automatic source for that field on a CSV row; it's
  insert-only, same as Individual Sponsorship Text's own default, so it never overwrites
  an officer's own detail-modal edit. Non-members (an auto-assigned placeholder Reg
  Number, not a real membership number) never match any roster entry, which is
  correct — there's nothing to backfill from for them.

## Settings: Developer → ⚙ Settings

A small app-wide settings store, `app-settings.json` / `app-settings.php` (same
list/save shape, same dual auth as every other endpoint here). Reachable from the same
"Settings" modal `🧪 Run Regression Tests` already opened (that menu item now sits
alongside a dedicated `⚙ Settings` entry — both open the same modal; the settings below
are its first two sections, regression tests are the third). Current settings:

- **First NonMember Number** (default 2000) — the starting number
  `nextAvailableWalkinNumber()` auto-assigns to a Walk-In Nonmember. Deliberately **does
  not** affect the CSV import's own nonmember numbering (still hardcoded at
  `CONFIG.firstNonMember`/8001 in `config.js`) — the two pools are intentionally kept
  independent so changing this setting can never renumber or collide with
  already-imported CSV registrations.
- **Walk-In Car Show Registration** (default $50) / **Walk-In Non Car Show Registration**
  (default $0) — fill in the Add Registration form's Total Fee Collected field based on
  its In Car Show? field (Yes -> Car Show fee, No -> Non Car Show fee — a real stored
  column, not a separate form-only field). Still freely editable after that.
- **Preregistration** (default $40) — reference figure only, not applied anywhere in the
  UI. CSV-preregistered attendees' fees come from the ClubExpress export itself, not
  this setting.
- **externalApiKey** — not an editable form field here; see "Paid Registrations API"
  below. Stored in the same `app-settings.json`, generated automatically.
- **Car Show Window Card** (`windowCardPdf`) — the fillable PDF template used when printing
  a registrant's window card; see "Car Show Window Card printing" below.
- **T-Shirt Vendor → Vendor Email** (`tshirtVendorEmail`) — reference contact only, not
  used to send anything automatically anywhere in the app. Light validation only
  requires an `@` if non-blank.

## Car Show Window Card printing

Officers can print a per-registrant "window card" (a small card meant for a car's
dashboard/windshield) either one at a time from the Registration tab's detail modal, or
in bulk for a checked selection from the Registration tab's own toolbar. This fills a
real fillable PDF template client-side via the vendored `pdf-lib` library
(`vendor/pdf-lib.min.js`, inlined into the build by `build.js` same as `exceljs`/
`papaparse` — exposes a `window.PDFLib` global), rather than drawing text over an
uploaded background image in HTML/CSS as an earlier version of this feature did.

- **Uploading the template** — Developer → ⚙ Settings → "Car Show Window Card" has a
  file picker (PDF only, 10 MB max) + Upload button, plus a "View current template" link
  when one's already uploaded. Unlike every other setting here (plain JSON values), this
  is a real file, so it's a separate multipart upload to its own endpoint,
  `window-card-pdf.php` — not folded into `app-settings.php`'s JSON-body `save` action.
  That endpoint validates the upload is actually `application/pdf` (via `finfo`), saves
  it to disk as `window-card.pdf` (overwriting any prior upload), then updates
  `app-settings.json`'s `windowCardPdf` key with the filename — same
  read-modify-write-without-clobbering pattern `app-settings.php` itself uses. The PDF is
  **not** denied by `.htaccess` (unlike the JSON data files) — it's meant to be publicly
  fetchable (`fetch("window-card.pdf")`) so `pdf-lib` can load its bytes client-side.
- **Template's expected form fields** — the uploaded PDF's AcroForm must have text fields
  named exactly `Owner`, `CarNumber`, `Year`, `Model`, `Generation`. A template missing
  one of these just leaves that field unfilled rather than failing the whole print (see
  `fillOneWindowCard()`'s per-field try/catch) — same tolerant-optional-field philosophy
  as `members-import.php`'s column detection.
- **Printing one card** — the detail modal's "🪟 Print Window Card" button calls
  `printWindowCard(r)`, a 1-element wrapper around the shared `printWindowCards(list)`
  (see below).
- **Printing several at once** — the Registration tab toolbar's "🪟 Print Window Cards"
  button (`printSelectedWindowCards()`) prints one card per **checked row whose In Car
  Show? is exactly "Yes"** — a checked row with any other value (No, blank) is silently
  skipped. The button's own label shows a live count of how many checked rows currently
  qualify (e.g. "🪟 Print Window Cards (3)") and stays disabled at 0, so there's no
  surprise about what's about to print. Reuses the same `state.regSelected` checkbox
  state the bulk-delete button already reads.
- **`printWindowCards(list)`** fetches the uploaded template's bytes once, then for each
  row: loads a fresh `PDFDocument` from those bytes (`fillOneWindowCard()`), fills its
  Owner/CarNumber/Year/Model/Generation fields with that registrant's Name/Reg #/Year/
  Model/Gen, and flattens the form (bakes the values into the page content) — flattening
  first avoids any field-name collision when multiple filled copies get merged into one
  document next. Each flattened single-page PDF's page is copied into one shared output
  `PDFDocument` (`outDoc.copyPages`/`addPage`), which is then saved to bytes, wrapped in a
  `Blob`, and opened in a new tab via `window.open(URL.createObjectURL(blob), "_blank")`
  — the browser's own PDF viewer handles printing from there (Ctrl+P / its print icon),
  which is more reliable across browsers than trying to script `window.print()` against
  PDF content this app doesn't control the rendering of.
- **No template uploaded yet, or `pdf-lib` fails to load/fill** — both surface as a plain
  `alert()` rather than a modal error state, since print is a fire-and-forget toolbar/
  detail-modal action with no natural "stays open" surface to show an inline error in
  (unlike Settings/the detail modal's own edit form, which do use `state.*Error` fields
  rendered inline).

## Paid Registrations API: Developer → 🔌 API

A read-only, external-facing feed of paid registrations for another website to consume
— e.g. `https://etccapps.com/apps/carshow/paid-registrations-api.php?key=<key>`. Returns
Member Number, First Name, Last Name, Phone, and Email for every current registration
(CSV-imported or Walk-In) whose Status classifies as "Paid" (same `classifyStatus()`
bucketing the Registration tab's own Paid/Not Paid/Cancelled/Empty filter checkboxes
use).

**Why this isn't computed server-side on request:** `logic.js`'s `generate()` pipeline
(shirt buckets, Corvette generation, non-member numbering, activity matching, deletions,
detail-modal edit overrides, Walk-Ins) is 100% client-side JavaScript with no PHP port —
see "Registrations: one always-current dataset" above. Rather than duplicate that whole
pipeline in PHP (a second implementation that would inevitably drift from the first),
the officer's browser — which already computes the fully-merged, always-current
registration list via `allRegistrations()` — pushes a filtered snapshot to the server
every time something paid-status-related changes: a CSV (re-)import, a detail-modal
Status edit, a Walk-In add/edit/delete, or a bulk delete. This means the feed is only as
fresh as the last time *any* officer had the app open when something changed — in
practice, at most a page-load's worth stale, since a fresh page load re-syncs it
unconditionally too (see `regenerate()`).

**Two files, two separate credentials:**

- **`paid-registrations-cache.php`** (internal) — POST-only, same PHP-session-or-password
  dual auth (`carshow_authed()`) as every other endpoint here. Called automatically by
  `app.js`'s `syncPaidRegistrationsCache()`; not meant to be called by hand. Writes
  `paid-registrations-cache.json` (denied by `.htaccess`, like every other data file).
- **`paid-registrations-api.php`** (external) — GET-only, the actual URL handed to
  another website. Authenticated by a **separate, narrower** key
  (`app-settings.json`'s `externalApiKey`), not the site password — accepted as either
  an `X-Api-Key` header or a `?key=` query param, checked with `hash_equals()`. Never
  touches PHP sessions. Just serves whatever `paid-registrations-cache.php` last wrote.

The key is generated at random (`bin2hex(random_bytes(16))`) the first time it's needed
— by whichever of `index.php`'s boot script or `app-settings.php`'s `get` action runs
first — and persisted from then on. It is **never hardcoded** in source, since this repo
is public. The Developer → 🔌 API screen (`app.js`'s `renderApiPage()`) shows the exact
URL (with a Copy button), the key itself (masked by default, with a Show toggle), a
Rotate Key button (`app-settings.php`'s `rotate_api_key` action — generates a fresh key
and immediately invalidates the old one), and a Test button that fires the literal
request another website would make (`credentials: "omit"`, so this browser's own login
session is never involved) and shows the raw HTTP status + response body.

## Registration tab: row checkboxes + bulk delete

A select-all/per-row checkbox column (leftmost, pinned alongside Reg #/Reg
Type/Last Name/First Name while scrolling — `PINNED_COUNT` in app.js is now 5) plus a
"🗑 Delete" toolbar button, same UX as the Sponsors tab's row selection. Deletion is
routed differently depending on the row's origin, since only Walk-Ins have a real
per-row server record:

- **Walk-In rows** (have a `.id`) are deleted outright via `walkin-registrations.php`,
  same as the detail modal's existing "Delete Walk-In Registration" button.
- **CSV-imported rows** have no per-row record of their own — `registrations-data.json`
  is wholly replaced by every fresh import. Instead, `csvRegKey(rec)` (the same
  Reg-Date+name identity `csvSponsorId()` already used for the Sponsors auto-sync) is
  added to a new `deleted-registrations.json` (via `deleted-registrations.php`,
  action=list/add). `regenerate()` filters `state.result.registrations` against this set
  every time it runs — including after a **later** CSV re-import that still contains the
  same row, so the exclusion survives indefinitely, not just until the next import. There
  is no "undo" UI for this; a deleted CSV row can only come back by hand-editing
  `deleted-registrations.json` on the server.
- Select-all only selects the currently *visible* (searched/filtered) rows, same as the
  Sponsors tab.

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
   `members-import.php`, `registrations-import.php`, `forgot-password.php`,
   `reset-password.php`, `logout.php`, `_login.html`, the logo, and `.htaccess`. Never
   touches `secrets.php` (see above — deliberately excluded so it can't revert a live
   password reset), `registrations-data.json`, `sponsor-submissions.json`,
   `members-data.json`, or `password-reset.json`.
