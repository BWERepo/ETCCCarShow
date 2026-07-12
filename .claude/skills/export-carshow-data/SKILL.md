---
name: export-carshow-data
description: Automates the two manual ClubExpress admin CSV exports (Registration Data, Activity Registrant Data) for the ETCC car show and saves them into the Exports folder with the right filenames. Use this whenever the user wants to "export the car show data," "pull the ClubExpress CSVs," "get today's registration/activity export," "grab the latest signups," "refresh the registration list/dashboard," or otherwise wants current car-show signup data — even if they don't say "ClubExpress" or "CSV" explicitly, e.g. "get the latest car show signups" or "show me who's registered so far." Do NOT use this for anything involving logging into ClubExpress, changing ClubExpress settings, or exporting data for events other than the car show.
---

# Export Car Show Data (ClubExpress → CSV)

## What this replaces

The manual process (documented in the workbook's Instructions sheet) is: log into
ClubExpress, open the event, click Admin Options → Exports → "Registration Data" →
Export → save; then repeat for "Activity Registrant Data". This skill drives the browser
through those ClubExpress clicks and saves the two files into the Exports folder with
the right names — it stops there. Loading the CSVs into the app (or the hosted site) is
a separate step the user triggers themselves.

## Which browser tool to use

Use **Claude in Chrome** (`mcp__claude-in-chrome__*` tools) for this skill, not the
Claude Browser pane (`mcp__Claude_Browser__*`). Claude in Chrome drives the user's actual
Chrome profile/cookies, where they're typically already logged into ClubExpress. The
Claude Browser pane is a separate, isolated session with its own cookie jar — confirmed
by a live run on 2026-07-12, navigating there landed on ClubExpress's login page even
though the user was logged in in their real Chrome at the time. If Claude in Chrome's
tools aren't loaded yet, fetch them first with `ToolSearch`
(`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__find,mcp__claude-in-chrome__tabs_create_mcp`)
before calling them.

## Hard rule: never touch login

This skill only works on an **already-logged-in** browser session. It must never type a
username, password, or attempt to authenticate in any way. If navigation lands on a
login page (or anything that looks like one), **stop immediately** and tell the user:
"You're not logged into ClubExpress — please log in (in the browser this skill is
using) and re-run /export-carshow-data." Do not guess credentials, do not retry logging
in, do not proceed past a login page under any circumstances, and do not silently switch
to a different browser tool to work around it — surface the problem and let the user
decide (e.g. whether to log in, or point you at a different already-authenticated
browser).

## Configuration — update this each new event

```
EVENT_URL = https://www.etccwebsite.com/content.aspx?page_id=4055&club_id=313652&item_id=2915148
```

This URL points at one specific event page (the `item_id` is per-event). When ETCC
creates next year's car show event, this URL will 404 or land somewhere unexpected —
if that happens mid-run, stop and tell the user the URL likely needs updating to point
at the new event's admin page, and ask them for the new URL (they can get it by opening
the event in ClubExpress and copying the address bar). Update the `EVENT_URL` line above
once they give it to you, so future runs don't need to ask again.

## Why this needs care on every run (not just the first time)

ClubExpress is someone else's website — its layout can change without notice, and this
skill was authored without being able to click through the live site (the browser tool
was disconnected at the time). So treat every run like it might be the first real test:
confirm each element before clicking it, and stop rather than guess if something looks
off. A wrong click that fires an unintended export, changes a setting, or submits a form
is much worse than pausing to ask the user. Speed is not the goal here — correctness is;
this only runs a couple of times a year.

## Steps

1. **Get a browser tab.** Call `mcp__claude-in-chrome__tabs_context_mcp` (with
   `createIfEmpty: true`) to get a tab ID — this is the user's real Chrome, so prefer
   creating a fresh tab over reusing whatever's already open, unless the user says
   otherwise.

2. **Navigate to `EVENT_URL`.** Take a screenshot. If you land on anything that looks
   like a login/sign-in form, stop and tell the user to log in first (see the hard rule
   above). Otherwise confirm you're on the event's admin-accessible page — as of
   2026-07-07 this URL lands directly on the event's "Admin Panels" page (title bar says
   `(Admin Panels)`), which already has an **Exports** button in its own toolbar
   alongside Registrations/Reports/Emailings/etc. There is no separate "Admin Options"
   click needed — if a future layout brings one back, use `find` for "Admin Options
   link or menu" first.

3. **Open Exports.** Click the **Exports** button in the event toolbar (or `find` it if
   the layout has changed). This opens an "Event Exports" dialog listing export types as
   radio buttons (Registration Data, Registrant Data, Activity Registrant Data, etc.).

4. **Export Registration Data:**
   - Click the **Registration Data** radio button.
   - **Re-screenshot before clicking Export.** Selecting a report type makes the dialog
     grow — a Status filter dropdown and the Export button appear below where they were
     before you clicked, so a coordinate aimed at the pre-selection layout will miss (this
     happened during testing: the click landed on empty dialog space and nothing
     happened). Confirm the Export button's new position from a fresh screenshot, then
     click it.
   - This triggers a browser download and the dialog closes on its own. Wait a couple
     seconds, then check the Windows Downloads folder — see "Finding the downloaded
     file" below. If nothing has downloaded after ~10 seconds and the tab seems
     unresponsive to screenshots, wait once more before concluding something's wrong;
     ClubExpress can take a few seconds to generate the file server-side.
   - **The `screenshot` action can itself time out** (`CDP sendCommand
     "Page.captureScreenshot" timed out`) without anything actually being wrong — seen
     repeatedly during the 2026-07-12 run, always resolved by a short `wait` and
     retrying the screenshot. Don't treat one timeout as a failure signal; wait ~2s and
     try again before concluding the page is stuck. If the Export click doesn't seem to
     have registered (dialog still open on the next screenshot), just click Export again
     at its current on-screen position rather than assuming something is broken.

5. **Export Activity Registrant Data:** repeat step 4's pattern — click Exports again,
   click the **Activity Registrant Data** radio button, re-screenshot to confirm the
   Export button's position, click it, wait, then locate the downloaded file.

6. **Move and rename both files** into
   `Z:\Backup\ETCC\Car Show\Exports\` as:
   - `registration_data<YYYYMMDD>.csv`
   - `activity_registrant_data<YYYYMMDD>.csv`

   using today's date. If a file with that exact name already exists (e.g. you're
   re-running this same day), overwrite it — today's export supersedes an earlier one
   from the same day.

7. **Stop here and report back** exactly what happened: the two source filenames as
   downloaded, the two destination filenames/paths they were saved as, and each file's
   row count. Do not open the app, start `serve.js`, or load the CSVs anywhere — saving
   the two files into the Exports folder is the entire job. If anything didn't work — a
   ClubExpress step couldn't find its element, a download didn't appear, or a file
   didn't look like the right export — report exactly where it stopped instead of
   declaring success.

## Finding the downloaded file

Confirmed by a live run on 2026-07-07: ClubExpress downloads these as exactly
`registration_data.csv` and `activity_registrant_data.csv` (no event ID or date in the
name — every export overwrites the same two names in Downloads). Still, don't hardcode
that as the only possibility — fall back to the newest `.csv` in Downloads if a file by
that exact name isn't there (ClubExpress could change this, or a browser download
counter suffix like `(1)` could appear if an old copy wasn't cleared):

```powershell
Get-ChildItem "$env:USERPROFILE\Downloads" -Filter *.csv | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

Sanity-check the file is actually new (its `LastWriteTime` should be within the last
minute or so — if the "newest" CSV is old, the download probably hasn't finished or
didn't start; wait and check again before giving up).

## Don't ask before each download

The user set this skill up specifically to run these two exports in one command without
being asked to confirm each one — that's the entire point of automating it. Once you've
verified you're clicking the right things (via `find` + screenshot), proceed through
both exports without pausing for permission. The transparency comes at the end: the
final report must clearly state both files that were saved, so the user always knows
exactly what happened even though you didn't stop to ask mid-run.
