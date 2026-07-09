# Hostinger deployment

Live at **https://etccapps.com/apps/carshow/**, password-protected with a branded login
screen matching SilentAuctionManager's style (see memory: silentauctionmanager-pattern).

Note the `/apps/` prefix is required even though hPanel lists the FTP account's home
directory as `public_html/carshow` (no `apps/` segment) — there's a server-level Alias
mapping `/apps/carshow/` to that directory, matching the URL convention every other
sub-app on this domain uses. Bare `/carshow/` 404s for everything, including brand new
files, because it isn't a real path under the actual document root.

## Layout

Server-side files (uploaded to the FTP account's home directory, which is already
scoped to `public_html/carshow` — check hPanel > Files > FTP Accounts if setting up a
new account):

- `index.php` — the gate. Serves `_login.html` until a session is authenticated
  (checked via `secrets.php`'s password hash), then serves `_data.html`.
- `_login.html` — the branded password screen (ETCC logo, purple gradient).
- `_data.html` — **generated, not committed** (see below) — the actual snapshot with
  real member PII baked in. Blocked from direct HTTP access by `.htaccess`.
- `secrets.php` — **not committed** — defines `$PASSWORD_HASH`. Copy
  `secrets.example.php` to `secrets.php` and fill in a real hash:
  `openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'`
- `.htaccess` — sets `DirectoryIndex index.php`, denies direct access to `_data.html`
  and `sponsor-submissions.json`.
- `ETCClogoWhiteBackground.png` — logo; canonical copy lives at `../assets/` (shared
  with the main app, which embeds it as base64 in the header), originally copied from
  SilentAuctionManager's Images folder.
- `sponsor-form.php` — **public, no login** — a standalone "Become a Sponsor" form with
  the same fields as the app's Sponsors tab. Meant to be linked/embedded from another
  website (e.g. the club's main site) so sponsors can submit their own info. Appends
  each submission to `sponsor-submissions.json` (gitignored, contains PII — created on
  first submission, blocked from direct HTTP access by `.htaccess`).
- `sponsor-submissions.php` — password-protected JSON API (checks the site password on
  every request, since the caller — the offline app — has no shared PHP session) that
  returns the accumulated list from `sponsor-submissions.json`. Used by the Sponsors
  tab's "Import from Server" button to pull new web submissions into the app.

## Sponsor form submissions

`sponsor-form.php` is public by design — it needs its own URL that works for a sponsor
visiting from another website, with no password. Submitted data only ever leaves the
server through `sponsor-submissions.php`, which requires the site password. In the app,
Sponsors tab → "Import from Server" prompts for that password, fetches, and merges any
submissions not already present locally (matched by id) into the local sponsor list.

`sponsor-submissions.json` is never touched by `ftp-deploy.sh` — it accumulates live on
the server and a deploy must not overwrite it.

## Refreshing the live data

1. Export fresh CSVs (`/export-carshow-data` skill, or manually into the Exports folder).
2. `node build.js` from `App/` if `src/` changed.
3. `node deploy/build-snapshot.js` — picks the newest CSVs automatically, writes
   `deploy/_data.html`.
4. `FTP_HOST=ftp.etccapps.com FTP_USER=u177039107.carshow FTP_PASS=... bash deploy/ftp-deploy.sh`

Dropping different CSVs into the *live* page itself does not update the server — the
app is client-side for that interaction, it only changes what that one visitor's browser
shows in that tab.
