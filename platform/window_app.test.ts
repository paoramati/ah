import { expect, test } from "vitest"
import { windowsAppBrowser, windowsAppCommand } from "./window.ts"

// Windows paths, built without backslash literals
const BS = String.fromCharCode(92)
const p = (...parts: string[]) => parts.join(BS)
const env = {
  "ProgramFiles(x86)": p("C:", "Program Files (x86)"),
  ProgramFiles: p("C:", "Program Files"),
  LOCALAPPDATA: p("C:", "Users", "me", "AppData", "Local"),
}
const edge86 = p(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe")
const chrome = p(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe")
const has =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path)

test("Edge is preferred over Chrome", () => {
  expect(windowsAppBrowser(env, has(chrome, edge86))).toEqual(edge86)
})

test("Chrome is used when Edge isn't there", () => {
  expect(windowsAppBrowser(env, has(chrome))).toEqual(chrome)
})

test("a per-user Chrome install is found", () => {
  const user = p(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
  expect(windowsAppBrowser(env, has(user))).toEqual(user)
})

test("no browser means no app window", () => {
  expect(windowsAppBrowser(env, has())).toEqual(null)
  expect(windowsAppCommand("http://127.0.0.1:7420/x", env, has())).toEqual(null)
})

test("the URL is one --app argument, with its & and ? intact", () => {
  const url = "http://127.0.0.1:7420/view/markdown/a~b~c/?in=window&x=1"
  expect(windowsAppCommand(url, env, has(edge86))).toEqual([edge86, [`--app=${url}`]])
})

test("AH_APP_WINDOW=0 keeps the tab", () => {
  expect(
    windowsAppCommand("http://x/", { ...env, AH_APP_WINDOW: "0" }, has(edge86)),
  ).toEqual(null)
})
