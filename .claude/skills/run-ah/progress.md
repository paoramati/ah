# Progress

## Decisions

- Path: native Windows (was WSL2; dropped because WSL cannot message native Windows Claude Code)
- Features: file views + chat; no Rex/jj/skepsis/dashboard
- Rule: runbook reviewed by user before ANY execution (installs, patches, config edits)

## Done

- Cloned upstream fork to C:\projects\ah; PR #1 (skill files) open on paoramati/ah
- Researched native feasibility: Windows named-pipe inbox exists, needs auth line with CLAUDE_CODE_MESSAGING_TOKEN
- WSL experiment (Ubuntu, Node 24, ah cloned and running there); abandoned, harmless
- Branch `windows-native` created (no code changes yet)
- Runbook rewritten for native (v2), awaiting review

## Code review (done, read-only)

- Runbook v3 has findings B1-B4 (blockers), T1, L1-L7 and patches P1-P8
- Key: hook already forwards currentAddress() to the server, so token needs only P2/P3; `openable()` (B1) breaks every file view on Windows paths

## Next

- User reviews runbook.md
- Then: phase 1 (npm install on Windows), read hook.ts/core.ts/registry.ts for P4, patch, test

## Open questions

- Does the hook-registered address carry the token to the server (P4)? Unread: core/hook.ts, core/core.ts ~280-300, core/registry.ts
- Wire format after the auth line on Windows (undocumented)
- Approve editing C:\Users\brand\.claude\settings.json (hooks + crossSessionInbound)?

## Gotchas

- WSL from Windows tools: Windows PATH leaks in; output UTF-16 (`tr -d '\0'`).
- Claude Code here: v2.1.319, pipe path in ~/.claude/sessions/<pid>.json (messagingSocketPath)

## Issues

(none)
