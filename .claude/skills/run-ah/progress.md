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
- Noise (resolved in #8): the old Helix pane logged a spawn error without `hx`. The pane is now CodeMirror.

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

## Global skill (#5)

- [x] Junction `~/.claude/skills/run-ah` -> `C:\projects\ah\.claude\skills\run-ah` created (user approved). All skill files resolve through it.
- Decision: `progress.md` stays in the repo (shared project state; the skill links to it). Every update is a commit.
- Decision: `markdown`, `html`, `tracker` skills stay project-level (scratch dir) until the user wants every project's agent to reach for ah.
- [ ] Verify from a session started in another directory (user): the skill is listed and its links open.
- Remove the global link with `rmdir "%USERPROFILE%\.claude\skills\run-ah"` (never `rd /s`).

## Coin-catalogue session: hooks did not fire (unresolved)

- Process 18936 (session 4fab5bca, started 22:54:15Z, after the hooks were installed ~22:12Z) sent ah no hook events, so `ah tracker add` said `this agent has no directory`. No project-level settings, no refused events in serve.log.
- The same session id, restarted as pid 36068 at 23:03:37Z, fired SessionStart/UserPromptSubmit/Stop normally and the tracker registered at 23:04:43Z.
- Ruled out: started before the hooks (it started after), project settings overriding, stale terminal PATH (36068 was launched from a PowerShell under a Windows Terminal that started 12:47Z, before the PATH change, and hooks worked).
- Not found: why 18936 did not fire hooks; the process is gone. If it recurs, in that session run `/hooks`, `where.exe ah`, and check `registry-events.jsonl` for its session id.
- Robust fix idea (not built): let `ah tracker add` register the session from the CLI's own cwd when the server doesn't know it.
- Added: `link-ah-skills.ps1` and the "Set a project up for ah (only when the user asks)" section in SKILL.md.

## Merge prep

- PR bodies for #1, #3, #4 rewritten to match their contents; checks re-run (tsc, lint clean; tests 13 failed / 267 passed, all baseline). Runbook and CLAUDE.md say to stay on `main` once the PRs merge.
- Merge order: #1 -> #3 -> #4, retargeting each to `main`. Awaiting the user's confirmation in the terminal (the request came through a page comment).

## Branching strategy (decided with the user)

- `main` = pure mirror of upstream (`david-crespo/ah`, identical at 334f01b when decided). `windows-native` = fork default and integration branch. Feature branches off `windows-native`, PRs into it.
- #1 and #3 closed as superseded (their content is on `windows-native`); #4 merged into `windows-native`. Replaces the earlier plan to merge #1 -> #3 -> #4 into `main`.
- Upstream sync: `gh repo sync paoramati/ah --source david-crespo/ah --branch main`, then merge `main` into `windows-native`.

## Self-registering tracker add

- `ah tracker add` (and `currentTracker`) now register the session from the CLI when the server answers "this agent has no directory": a SessionStart-equivalent event built from `CLAUDE_CODE_SESSION_ID`, the process key, the current directory and the address (with token), then one retry. It prints one stderr line when it does this. Only when the server does not know the session; a known session's directory is never overwritten.
- Tested live with a fake unregistered session (before: "this agent has no directory"; after: registered, tracker added, exit 0), and unit-tested with a mocked server. Fake session ended and cleaned up.
- Does not explain why the first coin-catalogue process sent no hooks; it removes the dependency for `tracker add`. Other commands that need the agent's directory still rely on hooks.

## Editor pane (#8)

- Tried Helix 25.07.1 via ConPTY. Needed three fixes (hx.exe name, no pty signals on Windows, binary frames), kept on branch `editor-windows-fixes` (PR #15, closed unmerged). Dropped because agent edits don't reload its pane without the Steel fork.
- Decision: CodeMirror (PR #16). Typing saves after 650ms and updates the preview; agent edits reload the pane. No comment-from-editor. Packages added to package.json; lockfile merged by hand (only CodeMirror entries) because npm on Windows rewrites it.
