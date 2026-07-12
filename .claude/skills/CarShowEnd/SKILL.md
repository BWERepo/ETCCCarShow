---
name: CarShowEnd
description: End-of-session wrap-up for the CarShow project — updates PROJECT_STATUS.md with everything accomplished in the current session, then commits and pushes it, written so a brand-new Claude Code session can resume with no prior context. Use when the user says "wrap up", "end of session", "update project status", or invokes /CarShowEnd.
---

# CarShow End-of-Session

When this skill is invoked, do two things in order:

1. Treat it exactly as if the user sent this message:

   > Update "Z:\Backup\Websites\CarShow\PROJECT_STATUS.md" with everything we've accomplished today. Make it detailed enough that a brand-new Claude Code session can resume immediately without needing previous conversation history.

   Carry out that instruction directly — read the current PROJECT_STATUS.md first to see its existing structure/style and preserve it, then review the session's work (code changes, git commits, bugs found and fixed, decisions made, and anything still pending) and write a thorough update.

2. Commit and push the update: stage `PROJECT_STATUS.md` (and any other files modified during the session that haven't been committed yet — check `git status`), commit with a descriptive message, and `git push origin main`. This is a **commit + push only** — do NOT run the deploy script as part of this skill; deploying is a separate, explicit "deploy" or "checkpoint" request.

Do not ask the user for confirmation before writing or committing; just do it and report back what was added and the resulting commit hash.
