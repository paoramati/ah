# Native Windows port notes

Upstream docs: "ah runs on macOS". Findings from reading source (partial).

| Piece            | File                                                                | Issue                                                                                                                                | Effort       |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Process table    | platform/proc.ts                                                    | `ps -axo pid=,ppid=,pgid=,args=`; returns [] on failure. Replace with PowerShell `Get-CimInstance Win32_Process`; no pgid on Windows | S            |
| Agent discovery  | platform/session.ts                                                 | UNREAD; likely walks ancestors                                                                                                       | M?           |
| Native windows   | platform/window.ts                                                  | Swift WKWebView, plutil, codesign. Stub; always `--in tab`                                                                           | S            |
| Focus            | platform/focus.ts                                                   | lsappinfo, osascript. Stub                                                                                                           | S            |
| Entry            | ah.ts                                                               | shebang; need `ah.cmd` shim                                                                                                          | S            |
| Scripts          | webview/build.sh, skills/tracker/lan-proxy.mjs, jq in skepsis skill | Unix shell assumptions                                                                                                               | S-M          |
| Editor           | hx Steel fork                                                       | use `--no-editor` or CodeMirror adapter                                                                                              | S            |
| PTY              | @lydell/node-pty                                                    | ConPTY supported, expected OK                                                                                                        | S            |
| Claude messaging | core/ (inbox socket)                                                | Unknown on Windows Claude Code. TEST FIRST                                                                                           | blocker?     |
| Dashboard        | views/dashboard, platform/rex.ts                                    | Needs Rex + jj. No Windows equivalent                                                                                                | L (redesign) |
| Tests            | *.test.ts                                                           | Unix path assumptions                                                                                                                | S-M          |

Estimate: file views only ~1-3 days; full parity weeks. WSL2 = hours, no code changes.
