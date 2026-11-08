# Dashboard equivalents on Windows: runbook (#21)

Upstream's dashboard (a native macOS window that follows the focused Rex tab) can't exist on Windows: no Rex, no jj, no WKWebView, and Windows Terminal has no tab or focus API to follow. Three small pieces stand in for it. Each has its own PR; this runbook assumes the ones you want are merged.

| Piece       | What it gives                                               | Command                                            | PR       |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------- | -------- |
| App window  | `--in window` is a chromeless Edge/Chrome window, not a tab | `ah view <file> --in window` (the default)         | #22      |
| Tracker hub | One page of every workspace's trackers with item counts     | `ah tracker hub`, or open `http://127.0.0.1:7420/` | #23      |
| Tray icon   | Taskbar icon: server up or down, pages open, menu           | `ah tray start`                                    | this one |

Not built: follow-focus (no API to follow), actions on the hub page (Go, Park), toast notifications.

## Preconditions

- Server running: `ah server status` (restart with `ah server restart`). The hub and tray read it on port 7420.
- Edge or Chrome installed, for the app window. Edge ships with Windows.
- Run from the repo checkout or have `bin\ah.cmd` on PATH (see `runbook.md`).

## App window

```
ah view .claude\notes\some-file.md --in window
```

- Opens `msedge.exe --app=<url>` (Chrome if no Edge). The window has no tab strip or address bar and is titled by the page.
- A page that is already open is left alone, not brought forward (Windows has no pid-to-window focus). It live-updates anyway.
- Back to tabs: set `AH_APP_WINDOW=0`, or use `--in tab`.
- Verify: list Chromium top-level windows by title (a script using `EnumWindows`, class `Chrome_WidgetWin_1`). An app window's title has no "- Microsoft Edge" suffix.
- If nothing opens: is Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` or Chrome under Program Files / `%LOCALAPPDATA%`? `windowsAppBrowser` in `platform/window.ts` looks there only.

## Tracker hub

```
ah tracker hub                  # opens it (a window if the app window is merged, else a tab)
curl http://127.0.0.1:7420/view/hub/?fragment=1     # the body alone, 200 when it works
```

- Lists every workspace that has trackers: Active open, Parked and Done collapsed. Per tracker: title (a link to its page), goal, item counts by status, a progress bar (done over items not dropped), the current one marked, when it was last used. Refreshes every 5 seconds without a reload.
- `/` redirects here off macOS.
- Counts come from the tracker files: items are `<ah-item ... status="...">`; the example item in the template's comment is ignored. A tracker whose file can't be read still lists as "(can't read this file)".
- Wrong or stale counts: the page reads the files on every refresh, so fix the file. A tracker that isn't listed isn't registered: run `ah tracker add <file>` from a session (or `ah tracker ls` to see this workspace's).
- Test: `npx vitest run core/tracker_summary.test.ts core/trackers.test.ts views/hub`.

## Tray icon

```
ah tray start      # prints "started, pid N"; "already running, pid N" if it is
ah tray status     # "running, pid N" or "not running"
ah tray stop
```

- Teal circle with an "a" when the server answers on its port, gray when it doesn't. The tooltip and the menu's top line read `ah: running, 3 pages open` or `ah: server not running`. Left click opens the hub. Menu: Open trackers, Server status, Restart server, Quit tray.
- One tray per port (a mutex, and a pid file `tray-<port>.pid` in the ah state dir). `ah tray start` twice does not double up. A stale pid file is removed when its pid isn't a `tray.ps1` process.
- It is `platform/tray.ps1` (PowerShell and Windows Forms, nothing to install), started with `Start-Process` because a PowerShell that ah spawns directly dies when ah exits.
- Check the script without a GUI: `powershell -File platform\tray.ps1 -Port 7420 -Once` prints the status line and the icon size, and exits.
- Windows 11 may put a new icon in the overflow flyout (the `^` by the clock). Drag it out to pin it. I could not confirm the icon shows from here: screen capture and UI Automation don't see the taskbar.
- Test: `npx vitest run platform/tray.test.ts`.

## Checked on this machine (2026-11-08)

- App window: a markdown page and a tracker each opened in their own window; opening the same page twice made one window.
- Hub: three workspaces listed with counts; a status change in a file showed up within 5 seconds; the tracker link returns 200; an unknown path is a 404.
- Tray: start, second start (no double), status after separate commands, the status text flips to "server not running" and back, stop removes the pid file.
- Not checked: the tray icon visible in the taskbar, the tray menu clicks, the app window against a Chrome-only machine.

## Gotchas found while building

- Edge keeps all its windows in one process, so `Get-Process msedge` shows one title; enumerate windows instead.
- `PrintWindow` and `CopyFromScreen` give a blank or desktop-only image of an Edge window here, so the app window can't be screenshotted from a script.
- Backslash literals vanish in bash heredocs and `node -e` (see `CLAUDE.md`); build Windows paths from `String.fromCharCode(92)` or edit with the Edit tool.
