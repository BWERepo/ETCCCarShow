---
name: CarShowBegin
description: Start-of-session resume for the CarShow project — reads PROJECT_STATUS.md and continues development from where the last session left off. Use when the user says "let's continue", "pick up where we left off", "start of session", or invokes /CarShowBegin.
---

# CarShow Begin-of-Session

When this skill is invoked, treat it exactly as if the user sent this message:

> Read "Z:\Backup\Websites\CarShow\PROJECT_STATUS.md" and continue development from where we left off.

Carry out that instruction directly — read the file, orient yourself on the current state of the project (recent work, known issues, pending tasks), and resume work accordingly. If PROJECT_STATUS.md points to specific next steps or open items, pick those up. If it's ambiguous what to do next, summarize the current state back to the user and ask what they'd like to work on rather than guessing.
