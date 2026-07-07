---
name: export-carshow-data
description: Automates the two manual ClubExpress admin CSV exports (Registration Data, Activity Registrant Data) for the ETCC car show, saves them into the Exports folder with the right filenames, then loads them into the ETCCCarShow.html app so the user sees the generated Registration table and Summary dashboard immediately. Use this whenever the user wants to "export the car show data," "pull the ClubExpress CSVs," "get today's registration/activity export," "grab the latest signups," "refresh the registration list/dashboard," or otherwise wants current car-show signup data — even if they don't say "ClubExpress" or "CSV" explicitly, e.g. "get the latest car show signups" or "show me who's registered so far." Do NOT use this for anything involving logging into ClubExpress, changing ClubExpress settings, or exporting data for events other than the car show.
---

# Export Car Show Data (ClubExpress → CSV → App)

## What this replaces

The manual process (documented in the workbook's Instructions sheet) is: log into
ClubExpress, open the event, click Admin Options → Exports → "Registration Data" →
Export → save; then repeat for "Activity Registrant Data"; then open the app and drop
the two files in. This skill drives the browser through the ClubExpress clicks AND loads
the results into the app, so the user goes from one command to seeing the finished
Registration table and Summary dashboard.

## Hard rule: never touch login

This skill only works on an **already-logged-in** browser session. It must never type a
username, password, or attempt to authenticate in any way. If navigation lands on a
login page (or anything that looks like one), **stop immediately** and tell the user:
"You're not logged into ClubExpress in Chrome — please log in and re-run
/export-carshow-data." Do not guess credentials, do not retry logging in, do not proceed
past a login page under any circumstances.

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

1. **Get a browser tab.** Call `tabs_context_mcp` (with `createIfEmpty: true`) to get a
   tab ID.

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

7. **Load the two files into the app** so the user sees the generated screens instead of
   just having CSVs on disk. See "Loading data into the app" below for exactly how —
   it's not drag-and-drop (browser automation can't drag a file, and can't navigate to
   `file://` either), it's a small local server plus a debug hook already built into the
   app for this purpose. After loading, take a screenshot of both the Registration tab
   and the Summary tab to confirm real data rendered (row counts, dollar figures, the
   shirt matrix — not a blank drop zone).

8. **Report back** exactly what happened: the two source filenames as downloaded, the
   two destination filenames/paths they were saved as, each file's row count, and the
   headline numbers from the Summary screen (registrations, attendees, funds, next
   member #). If anything didn't work — a ClubExpress step couldn't find its element, a
   download didn't appear, a file didn't look like the right export, or the app showed
   an error/warning message instead of a clean summary — report exactly where it stopped
   instead of declaring success. If the app's message log shows something like
   `Invalid activity title 'X'`, surface that to the user by name — it usually means a
   new ClubExpress activity type needs a mapping added to `App/src/config.js` (see the
   "Individual Sponsorship" case handled on 2026-07-07 for the pattern to follow), not
   that anything about the export itself failed.

## Loading data into the app

The app (`App/ETCCCarShow.html`) is designed to be opened as a local file and have CSVs
dragged onto it — but browser automation can't perform a real drag-and-drop, and (found
during testing) the `navigate` tool and even `location.href` mangle `file://` URLs into
a broken `https://file///...` address that Chrome tries to resolve via DNS. Both dead
ends. The reliable path:

1. **Serve the app over local HTTP** instead of opening it as a file. A tiny
   zero-dependency static server lives at `App/serve.js` for exactly this. Check if it's
   already running (e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5750/`
   — a `200` means it's up); if not, start it in the background:
   ```
   cd "Z:/Backup/Websites/CarShow/App" && (nohup node serve.js 5750 > /tmp/carshow-serve.log 2>&1 &)
   ```
   Then navigate the browser tab to `http://localhost:5750/ETCCCarShow.html` (a normal
   `http://` URL — this one navigates fine).

2. **Inject the CSVs via the app's debug hook**, `window.__carshow.ingestRows(regRows,
   actRows)` — the same hook the app's own automated tests use, so it exercises the
   exact same code path a real drag-drop would (it just skips the browser's file-reading
   step, which isn't needed since you already have the CSV text from disk). Read both
   CSV files with Bash, base64-encode them (avoids any quoting/escaping problems with
   commas, quotes, or newlines inside the CSV content when building the JS string), then
   run this via the `javascript_tool` (execute in the page, not a devtools snippet):
   ```js
   function b64ToUtf8(b64) {
     return decodeURIComponent(atob(b64).split('').map(function(c) {
       return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
     }).join(''));
   }
   var regRows = Papa.parse(b64ToUtf8("<base64 of registration CSV>"), { header: true, skipEmptyLines: true }).data;
   var actRows = Papa.parse(b64ToUtf8("<base64 of activity CSV>"), { header: true, skipEmptyLines: true }).data;
   window.__carshow.ingestRows(regRows, actRows);
   var s = window.__carshow.state.result.summary;
   ({ registrations: s.registrations, attendees: s.attendees, funds: s.funds, nextMemberNumber: s.nextMemberNumber, messages: window.__carshow.state.result.messages });
   ```
   The returned object is your quick correctness check — read it before bothering with a
   screenshot. Non-empty `messages` means something needs attention (see step 8 above).

3. **Leave the tab and server running** when you're done — don't close them or kill the
   server. The point of this step is the user gets a live, already-populated app window
   they can immediately click around in, search, switch to the Summary tab, hit Print,
   or hit Download Excel themselves. Don't click Download Excel for them unless they
   asked for the Excel file specifically — downloading a file is their call, not an
   automatic part of this skill.

4. **If you've edited anything under `App/src/`** (e.g. while fixing a new
   `activityTitleToBucket` mapping), you must run `node build.js` from the `App`
   directory before this step — `ETCCCarShow.html` is a pre-built bundle and does NOT
   pick up source edits automatically. Forgetting this was a real bug during
   development: the same "Invalid activity title" warning kept appearing even after the
   source fix, purely because the bundle was stale. Rebuild, then re-inject to confirm.

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
