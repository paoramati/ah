// `ah tray`: the Windows taskbar icon (tray.ps1), started hidden and detached,
// with its pid kept in the state dir so it can be stopped. It shows whether the
// server is running and how many pages are open, and opens the tracker hub
// (#21). It does nothing off Windows.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname } from "node:path"
import { assetPath } from "./assets.ts"
import { ahStateDir } from "./paths.ts"
import { run } from "./proc.ts"

export const trayPidFile = (port: number) => ahStateDir(`tray-${port}.pid`)

/** The pid in a pid file's text, or null */
export function parsePid(text: string): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The PowerShell that starts the tray script hidden and prints its pid. It goes
 * through Start-Process because a PowerShell that ah spawned itself, detached
 * or not, doesn't outlive ah; one Start-Process makes does. `ah` is the wrapper
 * the menu runs (bin/ah.cmd). Arguments with spaces are quoted for the child. */
export function startScript(port: number, script: string, ah: string): string {
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
    "-Ah",
    ah,
  ]
  return `(Start-Process powershell -ArgumentList ${args.map(quoted).join(",")} -WindowStyle Hidden -PassThru).Id`
}

/** Whether a command line is a tray script, so that a pid that has been reused
 * by something else is never killed */
export const isTrayCommandLine = (line: string) => /\btray\.ps1\b/.test(line)

async function commandLineOf(pid: number): Promise<string | null> {
  const { success, stdout } = await run("powershell", [
    "-NoProfile",
    "-Command",
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
  ])
  return success && stdout.trim() ? stdout : null
}

/** The running tray's pid, or null; a stale pid file is removed */
export async function runningTray(port: number): Promise<number | null> {
  const file = trayPidFile(port)
  if (!existsSync(file)) return null
  const pid = parsePid(readFileSync(file, "utf8"))
  const line = pid === null ? null : await commandLineOf(pid)
  if (pid !== null && line && isTrayCommandLine(line)) return pid
  rmSync(file, { force: true })
  return null
}

/** Start the tray if it isn't running. Returns what happened, for printing. */
export async function startTray(port: number): Promise<string> {
  if (process.platform !== "win32") return "the tray is Windows only"
  const running = await runningTray(port)
  if (running !== null) return `already running, pid ${running}`
  const script = startScript(port, assetPath("platform/tray.ps1"), assetPath("bin/ah.cmd"))
  const { success, stdout, stderr } = await run("powershell", [
    "-NoProfile",
    "-Command",
    script,
  ])
  const pid = success ? parsePid(stdout) : null
  if (pid === null) return `couldn't start the tray: ${stderr.trim() || stdout.trim()}`
  mkdirSync(dirname(trayPidFile(port)), { recursive: true })
  writeFileSync(trayPidFile(port), String(pid))
  return `started, pid ${pid}`
}

/** Stop the tray. Returns what happened, for printing. */
export async function stopTray(port: number): Promise<string> {
  const pid = await runningTray(port)
  if (pid === null) return "not running"
  try {
    process.kill(pid)
  } catch {
    // already gone
  }
  rmSync(trayPidFile(port), { force: true })
  return `stopped, pid ${pid}`
}
