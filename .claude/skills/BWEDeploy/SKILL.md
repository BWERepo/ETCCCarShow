---
name: BWEDeploy
description: Deploys the CarShow app's current code to the live Hostinger site via FTP — builds ETCCCarShow.html then runs deploy/ftp-deploy.sh. Use when the user says "deploy", "ftp", "push to the live site", or invokes /BWEDeploy. Does NOT commit or push to git — that's a separate "commit"/"checkpoint" request.
---

# BWEDeploy

When this skill is invoked, treat it exactly as if the user sent this message:

> Build the app and deploy it to the live site via FTP.

Carry out that instruction directly, from `Z:\Backup\Websites\CarShow\App`:

1. Run `node build.js` to rebuild `ETCCCarShow.html` from the current `src/` — this must
   happen before every deploy, since `ftp-deploy.sh` uploads that built file as
   `app-bundle.html`.
2. Run `bash deploy/ftp-deploy.sh` (reads FTP credentials from `deploy/.ftp-credentials`
   automatically if present).
3. Report back what was uploaded and whether it succeeded, including the final file
   listing `ftp-deploy.sh` prints.

This is a **build + FTP deploy only** — do NOT run `git add`/`commit`/`push` as part of
this skill; committing is a separate, explicit "commit" or "checkpoint" request. Do not
ask for confirmation before running; just do it and report back.
