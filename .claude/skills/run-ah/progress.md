# Progress

## Decisions

- Path: A, WSL2 (chosen by user)
- Features: file views only for now (no Rex/jj/skepsis)

## Done

- Cloned upstream to C:\projects\ah (334f01b), used for editing/notes
- Phase 0: WSL2 had only docker-desktop distro
- Installed Ubuntu (`wsl --install -d Ubuntu --no-launch`); created user `brand` (passwordless sudo, default user via /etc/wsl.conf)
- Phase 1 (partial): nvm + Node v24.22.2 in WSL. Claude Code NOT yet installed in WSL
- Phase 2: cloned to ~/src/ah (WSL), `npm install` ok, 0 vulns
- Phase 3: `ah` symlinked in ~/.local/bin, `ah -h` ok; `npm test` 275 pass / 8 skipped; `tsc` clean
- Phase 4: `ah server restart` ok; 7420 -> 302, 7421 -> 404 from Windows (reachable). Rex missing (expected)

## Next

- Install Claude Code in WSL
- Phase 5 hooks (needs approval to edit WSL ~/.claude/settings.json, backup first)
- Phase 6 skills, Phase 7 smoke test

## Gotchas learned

- Running WSL from Windows tools: Windows PATH leaks in (Windows npm). Use script files, strip /mnt/c from PATH, `nvm use 24`. `wsl` output is UTF-16: pipe through `tr -d '\0'`.
- Helper scripts in session scratchpad (p1-p4.sh) source nvm; use `bash -lc` interactive shell otherwise.
- Server may die when WSL idles; recheck `ah server status`.

## Open questions

- Claude Code on WSL: install + login needed
- OK to edit WSL settings.json?

## Issues

(none)
