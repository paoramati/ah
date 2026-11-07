# ah setup runbook (Windows 11)

Status: draft, nothing run. Published version: https://claude.ai/artifact/HtYdvuzubaT2ADnk3TKMie

Scope on Windows: file views (markdown/HTML), chat/comments to agent, agent-started task tracker. NOT: dashboard, tab titles, native windows (need Rex/jj/macOS).

## Decision: environment

- A. WSL2 Ubuntu (recommended): real Unix, Claude Code runs inside WSL. Browser on Windows reaches 127.0.0.1:7420 via localhost forwarding.
- B. Native Windows: needs source patches. See windows-port.md.

Steps below = A.

## Phase 0: prereqs (read-only)

PowerShell: `wsl --status`, `wsl -l -v`
Ubuntu: `node -v` (need >=24), `npm -v`, `git --version`, `claude --version`
Windows already has Node 24.8.0, npm 11.6.0, git 2.51.0, bun. Windows Node does not help path A.

- [ ] WSL2 + Ubuntu installed (`wsl --install -d Ubuntu`, admin, reboot)

## Phase 1: Node 24 + Claude Code in WSL

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install 24
node -v
```

Install Claude Code in WSL if missing (separate `~/.claude` from Windows).

- [ ] node v24.x in WSL

## Phase 2: clone + install (on WSL filesystem, not /mnt/c)

```
mkdir -p ~/src && cd ~/src
git clone https://github.com/paoramati/ah.git
cd ah && npm install
```

node-pty fallback: `sudo apt install build-essential python3 && npm rebuild`.
Note: Windows clone at C:\projects\ah is for editing/porting; WSL needs its own clone (or `/mnt/c/projects/ah`, slower, watcher issues).

- [ ] npm install exits 0

## Phase 3: PATH + checks

```
mkdir -p ~/.local/bin
chmod +x ~/src/ah/ah.ts
ln -s ~/src/ah/ah.ts ~/.local/bin/ah
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
exec $SHELL
ah -h
cd ~/src/ah && npm test && npm run tsc   # optional baseline
```

- [ ] `ah -h` lists groups

## Phase 4: server

```
ah server status
ah server restart
ah server status
```

Ports 127.0.0.1:7420 (API), 7421 (HTML). No auth: never forward. From PowerShell: `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:7420/`

- [ ] running, reachable from Windows

## Phase 5: Claude Code hooks (edits config; backup first)

WSL `~/.claude/settings.json`, merge into `hooks` (don't replace). Events SessionStart, UserPromptSubmit, Stop, SessionEnd, each:

```json
{
  "hooks": [{ "type": "command", "command": "ah hook agent --harness claude" }]
}
```

If permission prompts are bypassed, set `crossSessionInbound: "accept"`.

- [ ] backup, hooks added, JSON valid

## Phase 6: skills

Link markdown, html, tracker (skip panes = rex, skepsis = needs checkout):

```
mkdir -p ~/.claude/skills
for s in markdown html tracker; do ln -s ~/src/ah/skills/$s ~/.claude/skills/$s; done
```

- [ ] skills visible in new session

## Phase 7: smoke test

Start `claude` in scratch dir with test.md; second terminal: `ah view test.md --in tab`. Expect rendered markdown + chat; message reaches Claude. Then HTML page test (7421 origin). Confirm flags via `ah -h`. If browser doesn't open: `sudo apt install wslu`, `BROWSER=wslview`.

- [ ] view opens, message reaches Claude

## Troubleshooting

- No message to agent: check `~/.local/state/ah/registry-events.jsonl`; `ah` on PATH for Claude's shell.
- Port in use: `ah server stop`; `ss -ltnp | grep 742`.
- "can't reach or start the server": sandboxed shell; use normal terminal.
- Windows can't reach 7420: check `.wslconfig` networkingMode, firewall.
- Blank tab titles: expected without Rex.

## Rollback

```
ah server stop
rm ~/.local/bin/ah ~/.claude/skills/{markdown,html,tracker}
# restore ~/.claude/settings.json from backup
rm -rf ~/src/ah ~/.local/state/ah
```

Windows side untouched.

## Path B (native) sketch

`node ah.ts server restart`, `ah.cmd` shim, patch `processTable()`, always `--in tab`, hooks via shim, set XDG_STATE_HOME if desired. Unverified: Claude Code on Windows inbox socket. Details: windows-port.md.
