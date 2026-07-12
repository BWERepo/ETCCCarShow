---
name: BWECheckpoint
description: Full checkpoint for the CarShow project — runs the regression suite (adding coverage for anything recent that's missing), deploys via FTP, then commits and pushes to git. Use when the user says "checkpoint", "checkpoint everything", or invokes /BWECheckpoint.
---

# BWECheckpoint

When this skill is invoked, do the following four steps in order, without asking for
confirmation before each one — just do them and report back what happened at each step
(test results, deploy output, commit hash).

1. **Run the regression suite**: `node test/run-tests.js` from `Z:\Backup\Websites\CarShow\App`.
   Then look back over the session's changes so far and check whether anything
   genuinely testable (pure logic in `src/logic.js`/`src/config.js`/`src/excel.js`, no
   DOM/browser dependency) was added or changed without a matching assertion in
   `src/regression-tests.js`. If so, add assertions for it and re-run the suite to
   confirm they pass. Most UI-only changes (app.js DOM rendering, styling, layout) have
   no feasible Node-level test — don't force coverage that isn't realistic; see the
   note at the top of `src/regression-tests.js` for what's already explicitly
   out-of-scope there.
2. **Build and deploy**: `node build.js` then `bash deploy/ftp-deploy.sh` (reads FTP
   credentials from `deploy/.ftp-credentials` automatically if present) — same as the
   `/BWEDeploy` skill.
3. **Commit**: stage every file changed this session (check `git status` first) and
   commit with a descriptive message summarizing the session's work.
4. **Push**: `git push origin main`.

If the regression suite has any failing assertions, stop after step 1 and report the
failures instead of deploying/committing broken code — fix them first (or ask the user
how to proceed) before continuing to steps 2-4.
