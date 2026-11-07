# ah setup runbook: native Windows 11

Status: DRAFT v3 (code reviewed) for user review. Nothing here has been executed except the abandoned WSL experiment (appendix). Path: native Windows, because WSL sessions cannot message native Windows Claude Code.

Scope: file views (markdown/HTML) with chat/comments to the Claude Code session, agent-started task tracker. Out of scope: dashboard, tab titles, native windows, Rex, jj features, skepsis diff review.

## Facts (basis for the plan)

- Claude Code >= 2.1.234 supports cross-session messaging on native Windows over a **named pipe**. `~/.claude/sessions/<pid>.json` has `messagingSocketPath` like `\\.\pipe\LOCAL\cc-msg-<hash>` (seen here, Claude 2.1.319). Env `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN` are set in this session's Bash.
- On native Windows the first line on the connection must be `{"type":"auth","token":"<CLAUDE_CODE_MESSAGING_TOKEN>"}` or the connection is closed and nothing is delivered (docs). macOS makes it optional, so ah never sends it. The token is per session and is not in `sessions/<pid>.json`.
- ah's message line (existing): `{"type":"user","message":{"role":"user","content":"<text>"}}`. Format after the auth line is undocumented: verify by test.
- `crossSessionInbound`: `accept` | `hold` | `refuse`. If unset, prompting sessions ask for approval per message.

## Code review findings

Files read: session.ts, proc.ts, server.ts, window.ts, focus.ts, hook.ts, core.ts, workspace.ts, model.ts, tuis.ts, views/cli.ts, markdown/routes.ts, subjects/id.ts, bundle.ts.

### Blockers (ah unusable without these)

- **B1 `openable()` rejects every file.** core/workspace.ts:42 tests `path.startsWith(dir + "/")`. Windows paths use `\`, so `ah view <file>` always fails with "outside this directory". Fix with `path.relative`.
- **B2 Token never reaches the pipe.** `ah hook agent` (core/hook.ts) is a child of the session and already sends `currentAddress()` to the server on every hook event; the server keeps it in memory (`#addresses`, core.ts:473). So adding the token to the claude Address in `currentAddress()` carries it through hooks and `ah view` with no new plumbing. `postToClaude()` must then write the auth line first.
- **B3 Server fallback drops the token.** core.ts ~293: when the known address is not alive, the server rebuilds `{harness, socket}` from `sessions/<pid>.json`, with no token. Keep `own.token` when the socket matches. Addresses are in memory only, so after a server restart Windows delivery resumes at the session's next hook event (next prompt or Stop). Accept and document; do not persist tokens.
- **B4 Liveness check.** `addressAlive()` expects `<pid>.sock`; pipe names do not match, so it falls back to `statSync(pipe)`, unreliable. On win32 match `sessions/*.json` where `messagingSocketPath === socket`.

### Needed for trackers and media (not first smoke test)

- **T1** core.ts:583 and :594 reject paths not starting with `/` (tracker-status, trackers routes). core/workspace.ts:22 `rootFinder` returns null unless the path starts with `/`. views/markdown/routes.ts:184 `localMedia` uses `p.startsWith("/")`. Use `path.isAbsolute`.

### Low risk / cosmetic

- **L1 Window and focus are macOS-only.** `ah view` defaults to `--in window` (Swift app, `open`, `lsappinfo`, `osascript`). On win32 fall back to a browser tab via `cmd /c start "" <url>` and skip focus logic.
- **L2** `isAhServe()` (server.ts:122) uses `ps -p`; on Windows it returns false. `server stop` still works (terminate, then reports stopped) but cannot detect stale pid files. Optional PowerShell lookup. `kill(pid,"SIGTERM")` on Windows is a hard terminate.
- **L3** `processTable()` (ps) is only used for Codex/opencode detection, Rex TUIs and window lookup. The Claude path uses `CLAUDE_PID`. It returns [] on failure; leave it.
- **L4** Tab-title summary runs an `ai` CLI; missing logs `summary-skipped`. Harmless.
- **L5** `url-key` written with mode 0600 (ignored on Windows; file is in your profile).
- **L6** Server logs `spawn rex ENOENT` and retries. Server ran fine without Rex on Linux; check log noise.
- **L7** Vite builds client bundles on first request. Expect a slow first page load.
- Node 24.8 runs `ah.ts` directly (type stripping). No build needed.
- Token safety: events are logged without the address (`#write("event", event)`) and `describeAddress` prints only the socket. Add a test that the token never appears in logs or `ah view ls`.

## Patches (not yet made)

Branch `windows-native` in C:\projects\ah. Target fork paoramati/ah, not upstream. One commit per item, in order.

| #   | Item  | Files                                                     | Change                                                                                                                                                                                     |
| --- | ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | B1    | core/workspace.ts                                         | `openable()` via `path.relative`; test with Windows-style paths                                                                                                                            |
| P2  | B2    | core/model.ts, platform/session.ts                        | Optional `token` on claude Address; `currentAddress()` reads `CLAUDE_CODE_MESSAGING_TOKEN`; `parseAddress` accepts it; `postToClaude()` writes the auth line first when a token is present |
| P3  | B3    | core/core.ts                                              | `address()` fallback keeps `own.token` if the socket is equal                                                                                                                              |
| P4  | B4    | platform/session.ts                                       | win32 pipe liveness via sessions json match                                                                                                                                                |
| P5  | L1    | platform/window.ts, platform/focus.ts, views/cli.ts       | non-darwin: tab fallback, `cmd /c start`, no focus code                                                                                                                                    |
| P6  | T1    | core/core.ts, core/workspace.ts, views/markdown/routes.ts | `isAbsolute` instead of `startsWith("/")`                                                                                                                                                  |
| P7  | shims | repo `bin/` or user bin dir                               | `ah.cmd` (`@node "%~dp0..\ah.ts" %*`) for cmd/PowerShell AND an extensionless `ah` sh script for Git Bash, since Claude hooks/Bash run under Git Bash. Verify `bash -c "ah -h"`            |
| P8  | tests | \*.test.ts                                                | token auth line, token not logged, pipe liveness, openable, rootFinder with Windows paths. Run `npm test`, `npm run tsc`, `npm run lint`, `npm run fmt:check`                              |

Unverified until tested: wire format after the auth line; whether hook env carries `CLAUDE_CODE_MESSAGING_TOKEN`; whether Git Bash resolves the shim.

## Phase 0: prerequisites (read-only)

- [x] Node >= 24 (v24.8.0), npm 11.6.0, git 2.51.0
- [x] Claude Code 2.1.319 (>= 2.1.234)
- [x] Repo cloned at C:\projects\ah (fork); skill PR #1 open on paoramati/ah
- [x] `CLAUDE_CODE_MESSAGING_TOKEN` and `_SOCKET` set in a Bash session here
- [ ] Same vars reach a hook command (temporary test hook that writes only "set"/"unset" to a file, never the value)

## Phase 1: install deps

```
cd C:\projects\ah
npm install
```

node-pty should have a win32 prebuilt (ConPTY). If it fails to load, continue with `--no-editor`.

- [ ] exits 0

## Phase 2: baseline, then patches P1-P8

Run `npm test` and `npm run tsc` before patching and record Windows failures (baseline on Linux: 275 pass, 8 skipped, tsc clean). Then patch per the table, committing each.

- [ ] baseline recorded
- [ ] patches done, checks green, no new failures

## Phase 3: shims and PATH

Put both shims from P7 in a dir on user PATH (e.g. `C:\Users\brand\bin`). Test `ah -h` from PowerShell and `bash -c "ah -h"` from Git Bash.

- [ ] works in both shells, from any directory

## Phase 4: server

```
ah server status
ah server restart
ah server status
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:7420/
```

Ports 127.0.0.1:7420 (API) and 7421 (HTML). ah has no authentication: do not forward ports. Allow the Windows Firewall prompt for private networks only if it appears.

- [ ] running; 7420 answers (302 expected)

## Phase 5: Claude Code config (edits user config; ask first; back up first)

File: `C:\Users\brand\.claude\settings.json`. Read it first, keep existing hooks, back up to `settings.json.bak-ah`. Add the same hook to SessionStart, UserPromptSubmit, Stop and SessionEnd:

```json
{
  "hooks": [{ "type": "command", "command": "ah hook agent --harness claude" }]
}
```

Also `"crossSessionInbound": "accept"` (or set via `/config`). Hooks run on every prompt in every session, so confirm `ah hook agent` exits 0 quickly and silently; roll back via the backup if not.

- [ ] backup taken
- [ ] hooks and setting added; JSON valid
- [ ] new session starts without hook errors

## Phase 6: skills

Junction `skills/markdown`, `skills/html`, `skills/tracker` into `C:\Users\brand\.claude\skills\` (`mklink /J`). Skip panes (Rex) and skepsis.

- [ ] visible in a new session

## Phase 7: smoke test

1. New Claude session in a scratch dir containing test.md.
2. In its Bash: `ah view test.md --in tab` opens a tab with rendered markdown and chat.
3. Send a chat message from the page; it should arrive as a user prompt.
4. Ask Claude to open an HTML page (html skill); comment on it (tests the 7421 origin).
5. On failure: check `%USERPROFILE%\.local\state\ah\serve.log` and `registry-events.jsonl`; confirm the session's hook event registered an address with a token; check `crossSessionInbound`.

- [ ] page opens; message delivered; reply returns

## Rollback

```
ah server stop
# restore settings.json from settings.json.bak-ah
# remove skill junctions, shims, PATH entry
git -C C:\projects\ah checkout main    # patches live on windows-native
rd /s /q %USERPROFILE%\.local\state\ah
```

## Risks

- Auth and wire format untested on Windows; P2/P3 are the core risk.
- After a server restart, posts to a session fail until its next hook event re-registers the token.
- Hooks touch every session; keep them silent and fast.
- ah has no authentication: any local process can message your sessions. Single-user machine only.
- Patches diverge from upstream (david-crespo/ah); keep them small for rebasing.
- Claude Code behaviour may change; this was written against 2.1.319.

## Appendix: WSL experiment (abandoned)

Ubuntu distro, user `brand`, Node 24 and a clone at ~/src/ah were set up and the server ran there. WSL sessions cannot message native Windows Claude Code, so it is unused. Remove with `wsl --unregister Ubuntu` if wanted.
