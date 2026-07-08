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
- `.htaccess` — sets `DirectoryIndex index.php`, denies direct access to `_data.html`.
- `ETCClogoWhiteBackground.png` — logo, copied from SilentAuctionManager's Images folder.

## Refreshing the live data

1. Export fresh CSVs (`/export-carshow-data` skill, or manually into the Exports folder).
2. `node build.js` from `App/` if `src/` changed.
3. `node deploy/build-snapshot.js` — picks the newest CSVs automatically, writes
   `deploy/_data.html`.
4. `FTP_HOST=ftp.etccapps.com FTP_USER=u177039107.carshow FTP_PASS=... bash deploy/ftp-deploy.sh`

Dropping different CSVs into the *live* page itself does not update the server — the
app is client-side for that interaction, it only changes what that one visitor's browser
shows in that tab.
