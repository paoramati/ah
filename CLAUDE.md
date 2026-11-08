# ah on Windows (fork notes)

This is a fork of `david-crespo/ah` (agent host: a local server + CLI that lets web UI tools talk to a running agent session) made to run on **native Windows 11 with native Windows Claude Code**. Upstream targets macOS; read the README for the idea, this file for what is true here.

Work tracking: issue #2 (port), #5 (setup docs, global skill), #6 HTML view, #7 tracker, #8 editor, #9 parked revs, #10 LAN not implemented. Skill with runbook and progress log: `.claude/skills/run-ah/`. PRs target this fork only (`paoramati/ah`), never upstream.

## What works / doesn't

Works: markdown views (`ah view file.md`), HTML views, chat and highlight comments sent to the Claude Code session, replies shown on the page, task trackers (Go, Park, Done, SessionStart context), paths with spaces, other drives and UNC.

Not supported, on purpose: dashboard, tab titles, native macOS windows (`--in window` opens an Edge/Chrome app window instead: chromeless, `msedge --app=URL`; `AH_APP_WINDOW=0` or no Edge/Chrome gives a tab; a page already open is not brought forward, #21), Rex, jj features (tracker revs stay blank, #9), skepsis diff review, LAN access (#10). The editor pane is CodeMirror, running in the page (no `hx`, no pty), chosen in #8; it has no vim keys. The Helix pane was tried and dropped (PR #15, closed; branch `editor-windows-fixes` keeps the fixes): it needs `hx.exe`, ConPTY needs the fixes in that branch, and agent edits don't reload it without the Steel fork. `helix_command.ts`, `pty.ts` and `terminal_pane.ts` are still in the tree, unused and unfixed on Windows.

## Commands

```
npm install                 # then: git checkout package-lock.json (npm on Windows rewrites it)
npm test                    # ~16 baseline failures on Windows, see below
npm run tsc
npm run lint
npx oxfmt --write <file>    # repo formatter (no semicolons, width 92)
ah server restart           # bin\ah.cmd (cmd/PowerShell) or bin/ah (Git Bash) on PATH
ah server status            # ports 127.0.0.1:7420 (API) and :7421 (HTML pages)
ah view <file> --in tab
ah tracker add <file> [--title T --goal G]
ah message send|respond|pending ...
```

Baseline failures that are not regressions: Unix-socket test fixtures (EACCES), `ai`/`codex` CLIs missing, `os.homedir()` env override in worker threads, file modes (0600), jj-ignore paths.

## How delivery works (read before touching messaging)

- Native Windows Claude Code exposes a named pipe (`\\.\pipe\LOCAL\cc-msg-...`). The first line sent must be `{"type":"auth","token":"<CLAUDE_CODE_MESSAGING_TOKEN>"}` or Windows closes the pipe unread.
- The token comes from the session's env. Only children of the session see it: the CLI and the hook (`ah hook agent`). The server keeps addresses (with token) **in memory only**. Tokens are never logged or written to disk.
- `postToClaude` refuses to post to a pipe without a token. The request then stays held and goes out when the session next reports a token (its next prompt in a hooked session, or any `ah` command run from it). Do not weaken this: before it, restarts silently lost messages (logged "delivered", never arrived).
- A session started before the hooks were added has no hooks. Re-register it by running an `ah` command, or feed the hook by hand: `node -e "console.log(JSON.stringify({hook_event_name:'UserPromptSubmit',session_id:process.env.CLAUDE_CODE_SESSION_ID,cwd:process.cwd()}))" | ah hook agent --harness claude` (use `process.cwd()`; hand-quoted backslashes get lost).
- `ah view <file>` binds the file to the session that ran it. To open a page without rebinding, open the URL with `rundll32 url.dll,FileProtocolHandler <url>`.
- `ah tracker add` files a tracker under the agent's registered workspace, and refuses a file outside the current directory.

## Writing code for Windows

- No `"/"` assumptions: use `path.sep`, `path.isAbsolute`, `path.relative`. Thread log names flatten `\`, `/` and `:`.
- No `ps`, `lsappinfo`, `osascript`, `open`, shebang-only entry points. Off macOS, `showUrl` opens a tab via `rundll32` (`xdg-open` elsewhere).
- Stopping a server on Windows verifies the pid's command line (CIM) before killing; keep that.
- Add tests for platform logic. `platform/session_token.test.ts` runs against a real named pipe on Windows and a unix socket elsewhere.

## Editing gotchas on this machine

- A post-edit hook (prettier) rewrites files edited with Edit/Write, adding semicolons. For source files: edit, then run `npx oxfmt --write <file>`, then check `git diff` is only your change. Upstream files already differ slightly from oxfmt output here; revert unrelated formatting hunks.
- `core/core.ts` is CRLF in the working copy. Patch scripts must normalise line endings.
- The Bash tool halves backslashes in heredocs and `node -e` strings. Avoid backslash literals in generated code; use `[.]`, `String.fromCharCode(92)`, or the Edit tool.
- Git Bash rewrites UNC paths (`\\host\share`) and `C:\...` arguments. Use PowerShell for UNC and for `subst` tests.
- From WSL, nothing here is reachable by native Windows sessions (separate message domains). WSL is not used.
- Do not run `ah view` in a directory you don't want served: files must be under the current directory or its jj workspace.

## Git and PRs

- **`main`** is a pure mirror of upstream (`david-crespo/ah`). Never commit Windows work to it. Sync it: `gh repo sync paoramati/ah --source david-crespo/ah --branch main`.
- **`windows-native`** is this fork's default and integration branch. A fresh clone gets it. Branch off it (`git switch -c my-change windows-native`) and open PRs **into `windows-native`** on this fork.
- **Syncing upstream:** add the remote once (`git remote add upstream https://github.com/david-crespo/ah.git`), sync `main` as above, then `git switch windows-native && git merge origin/main` and resolve conflicts there. Keep patches small.
- Commit messages end with the `Co-Authored-By` line; reference the issue (`Refs #2`).
- Never force-push or amend pushed commits; add a follow-up commit.
- Changes to `~/.claude/settings.json` (hooks, `crossSessionInbound: "accept"`) need the user's explicit approval and a backup first; write JSON without a BOM.
