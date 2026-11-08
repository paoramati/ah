import { expect, test } from "vitest"
import {
  focusPidFile,
  isWatcherCommandLine,
  parsePid,
  startScript,
} from "./focus_watcher.ts"

test("parsePid reads a pid file, and only a pid", () => {
  expect(parsePid("1234\n")).toEqual(1234)
  expect(parsePid("")).toEqual(null)
  expect(parsePid("abc")).toEqual(null)
  expect(parsePid("0")).toEqual(null)
})

test("the pid file is per port", () => {
  expect(focusPidFile(7420)).toContain("focus-7420.pid")
  expect(focusPidFile(7420)).not.toEqual(focusPidFile(7500))
})

test("the start script launches the watcher hidden through Start-Process", () => {
  const ps = startScript(7420, "C:/x/focus_win.ps1")
  expect(ps).toContain("Start-Process powershell")
  expect(ps).toContain("'-File','C:/x/focus_win.ps1','-Port','7420'")
  expect(ps).toContain("-PassThru).Id")
})

test("the start script quotes paths with spaces and apostrophes", () => {
  const ps = startScript(7420, "C:/Program Files/it's/focus_win.ps1")
  expect(ps).toContain(`'"C:/Program Files/it''s/focus_win.ps1"'`)
})

test("only the watcher's command line counts", () => {
  expect(
    isWatcherCommandLine("powershell -File C:/ah/platform/focus_win.ps1 -Port 7420"),
  ).toEqual(true)
  expect(
    isWatcherCommandLine("powershell -File C:/ah/platform/tray.ps1 -Port 7420"),
  ).toEqual(false)
  expect(isWatcherCommandLine("")).toEqual(false)
})
