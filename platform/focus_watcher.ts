// `ah focus start|stop|status|now`: the watcher script (focus_win.ps1) that
// reports which terminal window is in front (#21), started hidden with its pid
// kept in the state dir, like the tray. It does nothing off Windows.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { assetPath } from "./assets.ts"
import { ahStateDir } from "./paths.ts"
import { run } from "./proc.ts"

export const focusPidFile = (port: number) => ahStateDir(`focus-${port}.pid`)

/** The pid in a pid file's text, or null */
export function parsePid(text: string): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The PowerShell that starts the watcher hidden and prints its pid. Through
 * Start-Process, because a PowerShell that ah spawns itself doesn't outlive ah
 * (see tray.ts). Paths with spaces are quoted for the child. */
export function startScript(port: number, script: string): string {
  const arg = (s: string) => (s.includes(" ") ? `"${s}"` : s)
  const quoted = (s: string) => `'${arg(s).replace(/'/g, "''")}'`
  const args = [
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-Port",
    String(port),
  ]
  return `(Start-Process powershell -ArgumentList ${args.map(quoted).join(",")} -WindowStyle Hidden -PassThru).Id`
}

/** Whether a command line is the watcher, so a reused pid is never killed */
export const isWatcherCommandLine = (line: string) => /\bfocus_win\.ps1\b/.test(line)

async function commandLineOf(pid: number): Promise<string | null> {
  const { success, stdout } = await run("powershell", [
    "-NoProfile",
    "-Command",
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
  ])
  return success && stdout.trim() ? stdout : null
}

/** The running watcher's pid, or null; a stale pid file is removed */
export async function runningWatcher(port: number): Promise<number | null> {
  const file = focusPidFile(port)
  if (!existsSync(file)) return null
  const pid = parsePid(readFileSync(file, "utf8"))
  const line = pid === null ? null : await commandLineOf(pid)
  if (pid !== null && line && isWatcherCommandLine(line)) return pid
  rmSync(file, { force: true })
  return null
}

export async function startWatcher(port: number): Promise<string> {
  if (process.platform !== "win32") return "following focus is Windows only"
  const running = await runningWatcher(port)
  if (running !== null) return `already running, pid ${running}`
  const script = startScript(port, assetPath("platform/focus_win.ps1"))
  const { success, stdout, stderr } = await run("powershell", [
    "-NoProfile",
    "-Command",
    script,
  ])
  const pid = success ? parsePid(stdout) : null
  if (pid === null) return `couldn't start the watcher: ${stderr.trim() || stdout.trim()}`
  mkdirSync(dirname(focusPidFile(port)), { recursive: true })
  writeFileSync(focusPidFile(port), String(pid))
  return `started, pid ${pid}`
}

export async function stopWatcher(port: number): Promise<string> {
  const pid = await runningWatcher(port)
  if (pid === null) return "not running"
  try {
    process.kill(pid)
  } catch {
    // already gone
  }
  rmSync(focusPidFile(port), { force: true })
  return `stopped, pid ${pid}`
}
