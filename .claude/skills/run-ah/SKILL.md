---
name: run-ah
description: Get and keep paoramati/ah (agent host) running on this Windows 11 machine. Holds the runbook, decisions, progress log and known issues for the initiative. Use when asked to run, set up, fix, port or debug ah here.
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
