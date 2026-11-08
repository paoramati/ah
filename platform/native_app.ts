// ah's native window on Windows (webview-win/, #27): where the built exe is, and
// the command that opens a page in it. `showUrl` (window.ts) prefers it for the
// "window" place; without it, or with AH_APP_WINDOW=0, pages open as before.

import { existsSync } from "node:fs"
import { spawn } from "node:child_process"
import { assetPath } from "./assets.ts"
import { ahStateDir } from "./paths.ts"

/** Where webview-win/build.ps1 puts the app */
export const nativeAppExe = () => assetPath("webview-win/build/ah-app.exe")

/** The command that opens `url` in the native window, or null to use something
 * else: AH_APP_WINDOW=0 asks for a tab, and the app may not be built. */
export function nativeAppCommand(
  url: string,
  title: string,
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
  exe: string = nativeAppExe(),
): [string, string[]] | null {
  if (env.AH_APP_WINDOW === "0") return null
  if (!exists(exe)) return null
  return [
    exe,
    [
      "--url",
      url,
      "--title",
      title,
      "--data",
      ahStateDir("webview"),
      "--state",
      ahStateDir("window-state.txt"),
    ],
  ]
}

/** Open a page in the native window. It isn't waited for: a second launch for
 * a URL already open brings that window forward and exits. */
export function openNativeApp(command: [string, string[]]) {
  const [cmd, args] = command
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref()
}

/** Run webview-win/build.ps1 with its output shown. Resolves to its exit code. */
export function buildNativeApp(): Promise<number> {
  return new Promise((resolve) => {
    const script = assetPath("webview-win/build.ps1")
    const child = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
      { stdio: "inherit" },
    )
    child.on("error", () => resolve(1))
    child.on("exit", (code) => resolve(code ?? 1))
  })
}

/** Whether webview-win/build.ps1 has been run */
export const nativeAppBuilt = () => existsSync(nativeAppExe())
