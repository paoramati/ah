# Progress

## Decisions

- Path: native Windows (was WSL2; dropped because WSL cannot message native Windows Claude Code)
- Features: file views + chat; no Rex/jj/skepsis/dashboard
- Rule: runbook reviewed by user before ANY execution (installs, patches, config edits). Runbook approved 2026-11-08; Phase 5 (settings.json) still needs a fresh ask + backup.
- Code lives on branch `windows-native-code` (separate PR from the docs). Issue: #2.

## Task list

Docs

- [x] Skill + runbook v1 (PR #1)
- [x] Runbook v3 after code review (PR #3)
- [x] Tracking issue #2

Phases

- [x] Phase 0: prerequisites (hook env check deferred to Phase 5)
- [x] Phase 1: `npm install` (revert package-lock.json churn after each install)
- [x] Phase 2: baseline (21 failed / 254 passed) and patches
  - [x] P1 `openable()` / `rootFinder()` Windows paths (B1)
  - [x] P2 token on address + auth line (B2), tests on a real named pipe
  - [x] P3 server fallback keeps token (B3)
  - [x] P4 pipe liveness via session records (B4), test
  - [x] P5 browser tab outside macOS (L1)
  - [x] P6 `isAbsolute` (T1)
  - [x] P7 shims `bin/ah.cmd`, `bin/ah` (tested in Git Bash and PowerShell)
  - [ ] P3 unit test (core.address fallback) not written
  - [ ] L2 optional `isAhServe` lookup, skipped for now
- [ ] Phase 3: put `C:\projects\ah\bin` on user PATH
- [ ] Phase 4: server start, check 7420/7421
- [ ] Phase 5: settings.json hooks + crossSessionInbound (ASK FIRST, back up)
- [ ] Phase 6: skills junctions
- [ ] Phase 7: smoke test

Test status: 16 failed / 263 passed / 8 skipped (was 21 failed). Remaining failures are baseline: Unix socket fixtures in tests (EACCES), `ai`/`codex` CLIs not installed, homedir env override in worker threads, file mode 0600, `.jj` ignore paths.

## Open questions

- Do hook commands receive `CLAUDE_CODE_MESSAGING_TOKEN`? (test in Phase 5)
- Wire format after the auth line on Windows (undocumented; assumed same user-message line)
- Approve editing `C:\Users\brand\.claude\settings.json` (hooks + crossSessionInbound)?

## Gotchas

- Claude Code here: v2.1.319, pipe path in `~/.claude/sessions/<pid>.json` (`messagingSocketPath`)
- A post-edit formatting hook rewrites edited files with semicolons. For source files: edit with node/sed scripts (not Edit/Write), then run `npx oxfmt --write <file>`. Keep diffs minimal; upstream files already differ slightly from oxfmt output on this machine.
- `core/core.ts` has CRLF in the working copy; patch scripts must normalise line endings.
- The Bash tool halves backslashes in heredocs: avoid backslash literals in generated code (use `[.]`, `String.fromCharCode(92)`).
- WSL from Windows tools: Windows PATH leaks in; output UTF-16 (`tr -d '\0'`).

## Issues

(none)
