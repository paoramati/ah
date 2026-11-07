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
- [x] Phase 3: bin dir on user PATH (new shells only)
- [x] Phase 4: native server runs; 7420 302, 7421 404
- [x] Phase 5: hooks + crossSessionInbound applied by user via apply-ah-config.ps1; backup settings.json.bak-ah; BOM stripped afterwards
- [ ] Phase 6: skills junctions (not started)
- [~] Phase 7: delivery PASSED (ah message send -> this session over the pipe with auth line, reply via ah message respond). Still to check: hook env token in a NEW session, chat from the page, HTML view

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

## Findings from live test

- Delivery works: comment on a file -> server -> Claude pipe with auth line -> arrives as a message. Wire format after the auth line was the existing user-message line.
- New bug fixed: thread log name kept `\` and `:` of Windows paths (ENOENT). Commit "Flatten Windows paths in thread log file names".
- Bug to fix: `ah server stop/restart` kills the pid blindly on Windows (`isAhServe` uses `ps`). Verify the command line before killing (L2).
- Log noise: Rex retry loop logs every ~2s (955 reconnects in 31 min).
- WSL server on 7420 shadowed the native one via localhost forwarding; WSL was terminated (`wsl --terminate Ubuntu`).
- apply-ah-config.ps1 wrote a UTF-8 BOM into settings.json; stripped. Use `-Encoding utf8NoBOM` or node for JSON in future.

## Parity pass (this session)

- [x] L2 server stop/restart verifies the pid (Windows command line via CIM; also accepts "server serve"). Restart tested.
- [x] Rex retry loop backs off to 60s and logs once when Rex is missing.
- [x] Unit test: address fallback keeps the token for the same socket (core.test.ts).
- [x] Chat message from the page delivered and answered (file comment + chat both work).
- [x] Restart behaviour verified live: after `ah server restart` the server has no address, a page message stays `waiting`, and it flushes the moment the session's address is re-registered (any `ah` CLI call from the session, or a hook event). No loss, only delay.
- [ ] HTML view, tracker, skills (Phase 6), fresh-session hook env check.
- Noise: markdown view's helix pane tries `hx` via node-pty and logs a spawn error when `hx` is missing (use `--no-editor`).

## Restart and hook results

- [x] Hooked session: after `ah server restart` a page message is held and flushed by the session's next UserPromptSubmit hook (22:34:05.941 hook, 22:34:06.003 delivered). Hook runs silently with the token.
- [x] Fixed a silent-loss bug: a post to a Windows pipe without the token was logged as delivered. `postToClaude` now throws, so the request stays held.
- [x] Park / Done buttons, tracker state across restart.
- Hand-fed hook events (`node -e ... | ah hook agent --harness claude`) are a valid way to test hook behaviour from an unhooked session.
- Don't run `ah view <file>` from another session to open a file you want to keep bound elsewhere: it rebinds the file. Open the URL with `rundll32 url.dll,FileProtocolHandler <url>`.
- Still open: tracker items 3-5, `UV_HANDLE_CLOSING` assertion, `ps` warning, editor (#8), skills global (#5), PR merge order.

## Tracker wrap-up

- Tracker checks done (Park/Done, restart, SessionStart context, Go on hold, spaces and another drive). Issue #7 body ticked.
- Parked: revs without jj -> #9. Unimplemented on purpose: LAN access / `lan-proxy.mjs` -> #10. Open question: tracker overview without the dashboard (in #7).
- `UV_HANDLE_CLOSING` was a one-off from the dashboard spawn crash; no fix needed (correction on #2).
- UNC paths tested through the local admin share (localhost, c$): tracker add, view, status, dir lookup and comments all work.
