# Follow-focus on Windows: runbook (#21)

The last unbuilt dashboard stand-in. Upstream's dashboard switches to the workspace of the focused terminal tab. This runbook is a plan to work against, with the feasibility spike first, because the earlier assumption ("Windows Terminal has no tab API, so it can't be done") was about tabs, not about windows.

Done so far (see `dashboard-runbook.md`): app window (#22), tracker hub (#23), tray icon (#24). Follow-focus would sit on top of the hub: the hub highlights and scrolls to the workspace you are working in.

## Idea in one line

Watch which window is in the foreground, walk from its process to an ah agent (`claude-<pid>`, which has a `cwd`), and tell the hub which workspace that is. No Rex, no tab API: it follows the focused **window** and, where the terminal puts one agent per window, that is enough.

## What ah already has

- `AgentRecord` (`core/model.ts`): `cwd`, `session`, `busy`, `summary`, keyed by `claude-<pid>` (the Claude Code process).
- `Trackers.workspaceOf(home)` (`core/trackers.ts`): an agent's workspace root, used today for "the current tracker".
- `processTable()` and `ancestors()` (`platform/proc.ts`): the process tree. On Windows the table comes from `Get-CimInstance Win32_Process`, so it has parent pids.
- The hub (`views/hub/`), which already lists workspaces and refreshes every 5s.

## Spike first (one hour, decides everything)

Answer these before writing product code. Each is a command to run and a result to record in `progress.md`.

1. **Does a foreground hook fire?** A PowerShell script using `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` that prints the foreground window's pid and title on each change. Switch between Windows Terminal, VS Code and a browser. Expect one line per switch.
2. **Can a window be tied to an agent?** For the foreground pid, walk descendants (`Win32_Process.ParentProcessId`) and look for a `claude` or `node` process whose pid matches a `claude-<pid>` in `ah debug agents`. Try: Windows Terminal with one tab, with two tabs, VS Code's integrated terminal, a plain `cmd` window.
   - One tab per window: expect a clean match.
   - Several tabs in one Windows Terminal window: the window has one pid for all tabs. Expect **no** way to tell which tab is focused from the process tree. Note what UI Automation says (`TabItem` selection state in the window), since that may recover it.
3. **UI Automation for the tab.** In the same Windows Terminal window, read the selected `TabItem`'s name through UIA (`System.Windows.Automation`). If the tab name carries the agent's title, or you can set it (`ah` already sets tab titles on macOS through Rex, not here), a match is possible.
4. **Cost.** Idle CPU of the hook script over five minutes. Anything above roughly 1% is a no.

### Decision after the spike

| Spike result | Do |
| --- | --- |
| 1 and 2 work for one-agent-per-window; tabs are indistinguishable | Build the window-level version below, and say its limit |
| 3 recovers the selected tab | Build the tab-level version too (UIA polling, only while a terminal is in front) |
| 1 fails or costs too much | Stop. Record why in `progress.md` and close the item in #21 as not feasible |

## Build, window-level (if the spike allows)

1. **Focus watcher** (`platform/focus_win.ps1`, started like the tray: `Start-Process`, one per port, pid file). On each foreground change it posts `{pid, title}` to the server: `POST /core/focus`.
2. **Server side** (`core/core.ts`, `core/focus.ts`): resolve pid to an agent by walking ancestors against the registry; keep `focusedWorkspace` in memory with a timestamp; `GET /core/focus` returns it. Pure resolver function, unit tested with a fake process table.
3. **Hub** (`views/hub/`): poll `/core/focus`; mark the matching workspace (an outline and "focused" tag) and scroll it into view; `?fragment=1` stays unchanged. Off by default if the watcher isn't running.
4. **CLI**: `ah focus start|stop|status`, same shape as `ah tray` (pid file, mutex, command-line check before kill).
5. **Notices**: with focus known, the current-tracker notice can be accurate again (today it is just "the last one bound"). Do this last, in its own PR; it changes what agents are told.

## Verify

- Unit: the resolver with a fake process table (agent found, no agent, two agents in one window, a reused pid).
- Live: open two terminals in two workspaces, each running Claude. Focus one, then the other; `curl http://127.0.0.1:7420/core/focus` follows within a second; the hub highlights the right workspace.
- Negative: focus a browser or an editor; the hub keeps the last workspace, marked stale after 30 s.
- Idle cost: Task Manager over five minutes, watcher near 0%.

## Risks

- **Tabs.** The reason this was written off. The spike may confirm it.
- **Privacy.** Window titles can hold anything. Post only the pid, and never log titles; resolve titles locally in the watcher if UIA is used, and send only the matched agent id.
- **Another process type per terminal.** VS Code, Cursor and JetBrains run terminals under one window pid too. Same limit as tabs.
- **Hook leaks.** `SetWinEventHook` needs a message loop; a leaked hook keeps the process alive. The watcher must unhook on exit (tray's Quit shows the pattern).

## Out of scope

Acting on the focus (Go, Park from the hub), anything that needs Rex, and macOS behaviour.

## Spike results (2026-11-08)

| # | Question | Result |
| --- | --- | --- |
| 1 | Does a foreground hook fire? | **Yes.** `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` reported each change with pid, process name and window class, with no delay (launching Paint and a dialog showed up at once). |
| 2 | Can a window be tied to an agent through the process tree? | **No, for Windows Terminal.** All four running agents were children of one `WindowsTerminal.exe` (one pid), in different PowerShell processes. The foreground pid is the same for every terminal window. |
| 3 | What does UI Automation say? | **There are five separate Windows Terminal windows, one tab each, in that one process.** Each window's title is its Claude session's title (for example "Issue 8 tracker"), so a window *is* one agent, and its title says which. |
| 4 | Cost | **About 0.3% of the machine** for the spike's polling loop (0.5 s of CPU over 15 s). The real watcher uses a message loop, which should be lower. |

### The finding that changed the plan

The process tree is the wrong tool here; the window title is the right one. Claude Code puts the session's title in the terminal window title and writes the same title to its transcript (`~/.claude/projects/<project>/<session>.jsonl`, `"type":"ai-title"`). So: foreground terminal window's title, matched to the live Claude agent whose latest `ai-title` is the same, gives the agent and its `cwd`.

### Decision

Built the window-level version (PR "Follow which terminal window is in front"). Not built: several tabs in one window (not how this machine is used, and UIA tab selection was not needed), and hub highlighting (the hub is a separate PR; this leaves the data at `GET /core/focus` and `ah focus now`).

### Built

- `platform/focus_win.ps1`: the watcher (message loop, 5 s re-report, terminal-class windows only, title only, `-Log` to diagnose).
- `core/focus.ts`, `POST` and `GET /core/focus`: title to agent to workspace, held in memory, ambiguous or unknown titles keep the previous answer, a report is "current" for 30 s.
- `ah focus start|stop|status|now`.

### Checked

- Real titles from the five open terminal windows posted through the watcher's own HTTP code mapped to the right agents and workspaces ("Issue 8 tracker" to `ah`, "Test.md" to `ah-scratch`, "Task list" to `jarvis`, "Restarting the AH server" to `coin-catalogue-matching`). "Windows PowerShell" and a made-up title kept the previous answer.
- `ah focus start`, `status` from a separate command, a second `start` (no double), `now`, `stop` (pid file removed).
- 13 new tests (title reading, matching, glyph stripping, staleness, the start script).

### Not checked: the live loop with a real focus change

The desktop foreground here was a window with no class or title (the watcher's log said so), so no terminal could be brought to the front and the hook could not be seen reporting a real switch end to end. The pieces each work (the hook fires on foreground changes, the posting code and matching work on real titles), but "switch windows and `ah focus now` follows" has not been seen. To check on a live desktop: `ah focus start`, click between two terminal windows, run `ah focus now` each time. If it doesn't follow, `powershell -File platform\focus_win.ps1 -Port 7420 -Log C:\temp\focus.log` shows what the watcher sees.

### Still open

- The hub marking the focused workspace (after the hub PR).
- Making the agent's "current tracker" notice use the focus (changes what agents are told: its own PR).
- Titles that two sessions share can't be told apart; the matcher says nothing rather than guessing.
