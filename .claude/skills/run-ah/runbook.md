# ah on native Windows 11: setup runbook (v4, verified)

Everything here was run and checked on this machine (Windows 11, Node 24.8, Claude Code 2.1.319) unless marked untested. Repo notes: `CLAUDE.md` at the repo root. Port tracking: issue #2.

Scope: markdown and HTML views, chat and highlight comments to the Claude Code session, task trackers. Not supported: dashboard, tab titles, native windows, Rex, jj features, skepsis, LAN (#10). Editor pane: see #8.

## Why native

Windows Claude Code exposes a named pipe (`\\.\pipe\LOCAL\cc-msg-...`, Claude Code >= 2.1.234) whose first line must be `{"type":"auth","token":"<CLAUDE_CODE_MESSAGING_TOKEN>"}`. WSL and native sessions cannot message each other, so ah must run natively. A WSL install from an earlier attempt can be removed (`wsl --unregister Ubuntu`); a WSL ah server also shadows the native one on port 7420.

## Setup

1. **Prerequisites:** Node >= 24, git, Claude Code >= 2.1.234.
2. **Clone and install**
   ```
   git clone https://github.com/paoramati/ah.git C:\projects\ah
   cd C:\projects\ah
   git checkout windows-native-code     # until the PRs merge to main
   npm install
   git checkout package-lock.json       # npm on Windows rewrites the lockfile
   ```
3. **Shims, PATH and Claude config:** run the script (reads nothing secret; backs up first):
   ```
   powershell -ExecutionPolicy Bypass -File C:\projects\ah\.claude\skills\run-ah\apply-ah-config.ps1
   ```
   It adds `C:\projects\ah\bin` to the user PATH (`ah.cmd` for cmd/PowerShell, `ah` for Git Bash, where Claude Code runs hooks and Bash), backs up `~/.claude/settings.json` to `settings.json.bak-ah`, adds `ah hook agent --harness claude` to SessionStart, UserPromptSubmit, Stop and SessionEnd (existing hooks kept), and sets `crossSessionInbound: "accept"`. **Needs the user's approval; the auto-mode classifier blocks it when run by the agent.** It writes JSON without a BOM.
4. **Start a new Claude session** so PATH and hooks load. In it, `ah -h` should work in both PowerShell and Git Bash.
5. **Server:** `ah server restart`, then `ah server status` and `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:7420/` (302). Port 7421 serves pages (404 at `/`). ah has no authentication: never forward the ports.
6. **Skills (optional):** link `skills\markdown`, `skills\html`, `skills\tracker` so the agent opens pages itself. Prefer project level: junctions in `<project>\.claude\skills\<name>` (`New-Item -ItemType Junction`), because they load only from that directory (restart needed). Global links go in `~/.claude/skills` (see #5) and affect every project. Remove a junction with `rmdir` or `(Get-Item <link>).Delete()`, never `rd /s`.

## Smoke test

1. In a scratch folder with `test.md`: `ah view test.md --in tab`.
2. Send a chat message or a highlight comment on the page: it arrives in the session as a message.
3. Answer with `ah message respond test.md start|done <request id> --text "..."`: the reply shows on the page.
4. Trackers: `ah tracker add .claude/notes/<date>-<slug>/index.html --title T --goal G`, add `<ah-item>` entries, `ah view` it, hover an item and click Go (an icon, not text).

## Behaviour to know

- After `ah server restart`, page messages are **held**, then delivered when the session next reports its token: its next prompt (hooked session) or any `ah` command run from it. The server logs "no messaging token for this session yet; held until it reports one".
- A session started before step 3 has no hooks: run an `ah` command from it, or feed the hook by hand (see `CLAUDE.md`).
- `ah view` rebinds the file to the session that ran it.
- `ah tracker add` files the tracker under the agent's registered workspace and refuses files outside the current directory.
- `serve.log` and `registry-events.jsonl` are in `%USERPROFILE%\.local\state\ah\`; thread logs are under `markdown\` and `html\` there.

## Troubleshooting

| Symptom                                              | Cause / fix                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Chat says working / waiting, nothing arrives         | Server restarted: token not re-registered yet. Send a prompt in that session or run any `ah` command from it |
| `ah: this agent has no directory`                    | Session isn't registered (no hook yet). Run the hook by hand or restart the session                          |
| Request logged `delivered` but never arrived         | Old build. Pull `windows-native-code` (fix: refuse posts without a token)                                    |
| `... is outside this directory and its jj workspace` | `ah` only serves files under the current directory; `cd` to the project                                      |
| `ah server stop` says the pid isn't an ah            | Another system answers on 7420 (e.g. a WSL server). Stop that one                                            |
| Spawn error from `node-pty` / `hx` on markdown pages | Helix isn't installed; use `--no-editor` (#8)                                                                |
| 7420 answers but `ah` shows no server                | A server on another port or stale pid file: `ah server status`, `ah server restart`                          |

## Rollback

```
ah server stop
# restore settings.json from settings.json.bak-ah (or remove the ah hooks and crossSessionInbound)
# remove <project>\.claude\skills junctions; remove C:\projects\ah\bin from the user PATH
rd /s /q %USERPROFILE%\.local\state\ah
git -C C:\projects\ah checkout main
```

## Risks

- ah has no authentication: any local process can message your sessions. Single-user machine only.
- Hooks run on every prompt in every session: `ah hook agent` must stay fast and silent (measured 0.4s, silent).
- The fork diverges from upstream (`david-crespo/ah`); the patches are small to ease rebasing.
- Claude Code's pipe and auth behaviour could change; this was verified on 2.1.319.
