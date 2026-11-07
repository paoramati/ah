# ah on Windows

This fork runs ah on native Windows 11 with native Windows Claude Code. Upstream's setup doc (`setup.md`) is for macOS.

- **Setup, smoke test, troubleshooting, rollback:** [`.claude/skills/run-ah/runbook.md`](../.claude/skills/run-ah/runbook.md)
- **How the fork works and what to watch when changing it:** [`CLAUDE.md`](../CLAUDE.md)
- **Config script** (PATH, Claude hooks, `crossSessionInbound`): [`.claude/skills/run-ah/apply-ah-config.ps1`](../.claude/skills/run-ah/apply-ah-config.ps1)
- **Port tracking:** issue #2; HTML view #6, tracker #7, editor #8, setup docs and global skill #5
- **Not supported on purpose:** dashboard, tab titles, native windows, Rex, jj features, skepsis, LAN access (#10)
