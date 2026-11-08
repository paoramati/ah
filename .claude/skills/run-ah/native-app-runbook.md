# Native window app (WebView2) on Windows: runbook (#27)

A small native window that hosts ah's pages, so ah has an app identity: its own taskbar button and icon, one window per page that comes forward instead of duplicating, and a title that follows the page. Issue #27.

## Preconditions (checked 2026-11-08)

| Need | Found |
| --- | --- |
| A C# compiler without an SDK | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` (.NET Framework 4, ships with Windows) |
| WebView2 runtime | Installed (`EdgeWebView`, 155 to 157) |
| The managed WebView2 libraries | `Microsoft.Web.WebView2` 1.0.2592.51 on NuGet: 8 MB, `lib/net462/*.Core.dll` and `*.WinForms.dll`, `runtimes/win-x64/native/WebView2Loader.dll` |
| No `dotnet` SDK | Not needed |

## Design

- **One C# file**, `webview-win/App.cs`, a Windows Forms `Form` holding a `WebView2` control. Compiled to `webview-win/build/ah-app.exe` with `csc.exe`, next to the three DLLs.
- **Arguments**: `--url <url>` (required), `--title <name>` (the window name until the page sets one), `--screenshot <png>` (load, save the page as a PNG, exit), `--data <dir>` (WebView2 user data folder).
- **Identity**: `SetCurrentProcessExplicitAppUserModelID("Paoramati.Ah")` so every ah window groups under one taskbar button with its own icon; the icon is drawn in code (the tray's teal circle), nothing shipped.
- **One window per URL**: a named mutex from a hash of the URL. A second launch for the same URL signals the first (a named `EventWaitHandle`) to come forward, and exits. This is what Edge's app mode could not do.
- **Title** follows `document.title` (`DocumentTitleChanged`).
- **Size and position** saved to `window-state.json` in the ah state dir on close, restored on open (clamped onto a visible screen).
- **Links off the local server** (anything not `127.0.0.1` or `localhost`) open in the default browser, and new-window requests do too.
- **Build**: `webview-win/build.ps1` downloads the pinned package into `webview-win/build/cache/` (not committed), extracts it into its own folder, compiles, and copies the DLLs next to the exe. Idempotent, rebuilds when `App.cs` is newer.
- **ah side**: `platform/native_app.ts` finds the built exe and builds its command; `showUrl` prefers it for `window` on win32, then Edge's app window (#22), then a tab. `AH_APP_WINDOW=0` still forces a tab. `ah app build` runs the build script.

## Steps

1. Branch `native-app` off `windows-native`. (Done with this file.)
2. `webview-win/App.cs`: the window, identity, title, bounds, link handling, `--screenshot`.
3. `webview-win/build.ps1`: fetch, extract, compile. Verify it builds from nothing.
4. Run it by hand on the hub and a markdown page; check title, taskbar identity, `--screenshot`.
5. Single instance: launch the same URL twice; one window, and the first comes forward.
6. `platform/native_app.ts` and the `showUrl` hook, with tests (command building, fallback order, opt-out).
7. `ah app build` and `ah app status`.
8. Docs (`CLAUDE.md`, README, `dashboard-runbook.md`), then the PR with a screenshot made by `--screenshot`.

## Verify

- Build from a clean `build/` directory: exits 0, `ah-app.exe` and three DLLs exist.
- `ah-app.exe --url http://127.0.0.1:7420/view/hub/ --screenshot x.png` writes a PNG of the hub and exits 0 (also proves WebView2 loaded the page).
- Window title equals the page title (enumerate top-level windows by process, `EnumWindows`).
- Taskbar identity: `GetCurrentProcessExplicitAppUserModelID` can't be read from outside, so check the property store on the window: `System.AppUserModel.ID` through `SHGetPropertyStoreForWindow`.
- Second launch of the same URL: still one process and one window; exit code 0 for the second.
- Move and resize, close, reopen: same bounds.
- Links: a unit-testable `IsLocal(url)`; the handler's other half is checked by reading the code and by clicking, which can't be done from here.

## Risks

- **WebView2 runtime missing** on some machines: the exe says so and ah falls back to Edge's app window.
- **The NuGet fetch** needs the network once. The script pins the version, checks the package's SHA-512 against the value recorded in the script, and never runs anything from the download except the DLLs it links against.
- **Visibility from here**: screen capture of windows doesn't work on this machine (see `dashboard-runbook.md`), so screenshots come from `--screenshot`, which is the page content, not the window frame.
- **DLL load path**: `WebView2Loader.dll` must sit beside the exe (x64 only; ah on arm64 would need the arm64 loader).

## Out of scope

Electron, an installer (#11), tabs in one window, auto-update, a tray menu inside the app (the tray icon (#24) already launches it).
