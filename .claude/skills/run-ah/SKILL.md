---
name: run-ah
description: Set up, run, fix or change `ah` (agent host, the paoramati/ah fork, checked out at C:\projects\ah) on this Windows 11 machine. Holds the verified runbook, config script, progress log and known issues. Use when the user mentions ah, agent host, `ah view`, `ah tracker`, `ah server`, the ah hooks, or the ah Windows port, from any project.
---

# run-ah

Initiative: run `ah` (local server + CLI, ports 7420 API / 7421 HTML pages) on Windows 11. Upstream targets macOS only.

## Rules

- Concise replies (user CLAUDE.md).
- The runbook is verified and the native path is chosen. Confirm with the user before editing config outside the repo (e.g. `~/.claude/settings.json`) and back it up first; the auto-mode classifier may block such edits, so give the user the script to run.
- Update `progress.md` after every step run or decision made.
- Server has no auth: never forward 7420/7421.

## Files

- [runbook.md](runbook.md): setup runbook for native Windows (v4, verified). Source of truth. `apply-ah-config.ps1` applies the PATH, hooks and `crossSessionInbound` change. The old published artifact https://claude.ai/artifact/HtYdvuzubaT2ADnk3TKMie is the superseded WSL2 draft.
- [progress.md](progress.md): decisions, done steps, open questions, issues.
- [windows-port.md](windows-port.md): original port analysis (historical; the fixes are in the code, see `CLAUDE.md` and issue #2).

## Workflow

1. Read `progress.md` for current state, and `CLAUDE.md` in the repo for how the fork works.
2. Follow `runbook.md`, one step at a time; verify each step.
3. Log outcome in `progress.md`. If runbook was wrong, fix `runbook.md`.
4. Repo is cloned at `C:\projects\ah` (upstream `main`). Local changes for the port go on a branch, not main.

## This session has no ah hooks

Symptom: `ah tracker add` says `ah: this agent has no directory`, or a page message stays `waiting`. The session started before the hooks were installed (or the hooks are missing). Nothing is wrong with ah.

Fix, in order:

1. Best: start a new Claude session (hooks and PATH load at start), or `claude --resume` from the same project directory.
2. Without restarting, from the project directory, run the hook by hand once (it is exactly what the SessionStart hook sends; uses `process.cwd()` so backslashes survive):

   ```
   node -e "console.log(JSON.stringify({hook_event_name:'SessionStart',session_id:process.env.CLAUDE_CODE_SESSION_ID,cwd:process.cwd()}))" | ah hook agent --harness claude
   ```

   Then retry `ah tracker add ...`. Repeat with `UserPromptSubmit` (and add `prompt:'x'`) after a server restart to re-register the session's token so held page messages go out.
3. If `ah` isn't found, the PATH entry is missing: run `.claude/skills/run-ah/apply-ah-config.ps1` (the user must approve; it edits `~/.claude/settings.json`), then start a new session.
