#!/usr/bin/env bash
# Uploads the deploy/ folder's server files to Hostinger over FTPS.
# Run `node deploy/build-snapshot.js` first so deploy/_data.html is current.
#
# Required env vars (not stored in this repo):
#   FTP_HOST  e.g. ftp.etccapps.com
#   FTP_USER  e.g. u177039107.carshow
#   FTP_PASS
#
# The account's FTP home directory is expected to already be the target
# folder (e.g. public_html/carshow) — check hPanel > Files > FTP Accounts >
# Directory if unsure. FTPS on Hostinger has historically failed hostname
# certificate validation for custom FTP hostnames (SEC_E_WRONG_PRINCIPAL) —
# this script uses -k to skip verification; the channel is still encrypted,
# just not identity-checked. Only run this against a host/account you trust.
set -euo pipefail

: "${FTP_HOST:?Set FTP_HOST}"
: "${FTP_USER:?Set FTP_USER}"
: "${FTP_PASS:?Set FTP_PASS}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="ftp://${FTP_HOST}"
NETRC="$(mktemp)"
trap 'rm -f "$NETRC"' EXIT

cat > "$NETRC" <<EOF
machine ${FTP_HOST}
login ${FTP_USER}
password ${FTP_PASS}
EOF

if [ ! -f "$DIR/_data.html" ]; then
  echo "deploy/_data.html not found — run 'node deploy/build-snapshot.js' first." >&2
  exit 1
fi

upload() {
  echo "--- Uploading $1 ---"
  curl -sS --netrc-file "$NETRC" --ftp-ssl -k --ftp-pasv -T "$DIR/$1" "$BASE/$1" -m 120
}

upload "_data.html"
upload "_login.html"
upload "index.php"
upload "secrets.php"
upload "ETCClogoWhiteBackground.png"
upload ".htaccess"

echo "--- Final listing ---"
curl -sS --netrc-file "$NETRC" --ftp-ssl -k --ftp-pasv "$BASE/" -m 20
