#!/usr/bin/env bash
# Uploads the deploy/ folder's server files (CODE, not DATA) to Hostinger
# over FTPS. Run `node build.js` first so App/ETCCCarShow.html is current —
# this script uploads that file as app-bundle.html, the template index.php
# stitches live data into on every request. To refresh DATA (registrations
# or sponsors) without a code change, use deploy/upload-registrations.js or
# the Sponsors tab instead — see README.md. This script does NOT touch
# registrations-data.json or sponsor-submissions.json, which live only on
# the server.
#
# Credentials: either set FTP_HOST/FTP_USER/FTP_PASS as env vars, or create
# deploy/.ftp-credentials (gitignored — copy .ftp-credentials.example and
# fill in the real password) and this script reads them from there instead —
# same pattern as ../BusinessWebExpress/.ftp-credentials. Env vars, if set,
# take precedence over the file.
#
# The account's FTP home directory is expected to already be the target
# folder (e.g. public_html/carshow) — check hPanel > Files > FTP Accounts >
# Directory if unsure. FTPS on Hostinger has historically failed hostname
# certificate validation for custom FTP hostnames (SEC_E_WRONG_PRINCIPAL) —
# this script uses -k to skip verification; the channel is still encrypted,
# just not identity-checked. Only run this against a host/account you trust.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CRED_FILE="$DIR/.ftp-credentials"
if [ -z "${FTP_HOST:-}" ] && [ -f "$CRED_FILE" ]; then
  # `|| [ -n "$key" ]` keeps the loop's last iteration even if the file has no
  # trailing newline (read exits nonzero on that final line but still
  # populates $key/$value — without this, the last KEY=VALUE line is silently
  # dropped). Stripping a trailing \r handles files saved with Windows line
  # endings (Notepad etc.), which would otherwise leave it stuck on the value.
  while IFS='=' read -r key value || [ -n "$key" ]; do
    key="${key%$'\r'}"
    value="${value%$'\r'}"
    case "$key" in
      FTP_HOST) FTP_HOST="$value" ;;
      FTP_USER) FTP_USER="$value" ;;
      FTP_PASS) FTP_PASS="$value" ;;
    esac
  done < "$CRED_FILE"
fi

: "${FTP_HOST:?Set FTP_HOST (env var, or create deploy/.ftp-credentials from the .example file)}"
: "${FTP_USER:?Set FTP_USER (env var, or create deploy/.ftp-credentials from the .example file)}"
: "${FTP_PASS:?Set FTP_PASS (env var, or create deploy/.ftp-credentials from the .example file)}"
BASE="ftp://${FTP_HOST}"
NETRC="$(mktemp)"
trap 'rm -f "$NETRC"' EXIT

cat > "$NETRC" <<EOF
machine ${FTP_HOST}
login ${FTP_USER}
password ${FTP_PASS}
EOF

if [ ! -f "$DIR/../ETCCCarShow.html" ]; then
  echo "App/ETCCCarShow.html not found — run 'node build.js' first." >&2
  exit 1
fi

upload() {
  local remoteName="$1" localPath="${2:-$DIR/$1}"
  echo "--- Uploading $remoteName ---"
  curl -sS --netrc-file "$NETRC" --ftp-ssl -k --ftp-pasv -T "$localPath" "$BASE/$remoteName" -m 120
}

# The built offline-tool bundle, re-uploaded under a different name — index.php
# reads this as its template and stitches in live server-side data on every
# request (see that file). It intentionally carries no baked-in CSV/sponsor data.
upload "app-bundle.html" "$DIR/../ETCCCarShow.html"
upload "_login.html"
upload "index.php"
upload "lib.php"
upload "secrets.php"
upload "sponsor-form.php"
upload "sponsor-submissions.php"
upload "registrations-upload.php"
upload "members-import.php"
# canonical copy lives in ../assets/, shared with the main app's build.js (which
# embeds it as base64) — see assets/ETCClogoWhiteBackground.png
upload "ETCClogoWhiteBackground.png" "$DIR/../assets/ETCClogoWhiteBackground.png"
upload ".htaccess"
# sponsor-submissions.json, registrations-data.json, and members-data.json are
# deliberately never uploaded here — they're the live, server-accumulated data
# (sponsor edits/submissions, uploaded registrations, imported member roster)
# and have no meaningful local copy to overwrite them with. See
# upload-registrations.js, members-import.php, and the Sponsors tab for how
# those actually get refreshed.

echo "--- Final listing ---"
curl -sS --netrc-file "$NETRC" --ftp-ssl -k --ftp-pasv "$BASE/" -m 20
