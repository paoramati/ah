import { expect, test } from "vitest"
import { nativeAppCommand } from "./native_app.ts"

const exe = "C:/x/webview-win/build/ah-app.exe"
const has =
  (...paths: string[]) =>
  (p: string) =>
    paths.includes(p)

test("the command opens the URL with its title and the ah state paths", () => {
  const cmd = nativeAppCommand(
    "http://127.0.0.1:7420/view/hub/?a=1&b=2",
    "Trackers",
    {},
    has(exe),
    exe,
  )
  expect(cmd?.[0]).toEqual(exe)
  const args = cmd![1]
  // The URL is one argument, with its & and ? intact
  expect(args.slice(0, 4)).toEqual([
    "--url",
    "http://127.0.0.1:7420/view/hub/?a=1&b=2",
    "--title",
    "Trackers",
  ])
  expect(args[args.indexOf("--data") + 1]).toContain("webview")
  expect(args[args.indexOf("--state") + 1]).toContain("window-state.txt")
})

test("no command when the app isn't built", () => {
  expect(nativeAppCommand("http://x/", "t", {}, has(), exe)).toEqual(null)
})

test("AH_APP_WINDOW=0 asks for a tab even when the app is built", () => {
  expect(nativeAppCommand("http://x/", "t", { AH_APP_WINDOW: "0" }, has(exe), exe)).toEqual(
    null,
  )
})
