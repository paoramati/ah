import { expect, test } from "vitest"
import { isTrayCommandLine, parsePid, startScript, trayPidFile } from "./tray.ts"

test("parsePid reads a pid file, and only a pid", () => {
  expect(parsePid("1234\n")).toEqual(1234)
  expect(parsePid("")).toEqual(null)
  expect(parsePid("abc")).toEqual(null)
  expect(parsePid("-5")).toEqual(null)
  expect(parsePid("1.5")).toEqual(null)
})

test("the pid file is per port", () => {
  expect(trayPidFile(7420)).not.toEqual(trayPidFile(7500))
  expect(trayPidFile(7420)).toContain("tray-7420.pid")
})

test("the start script launches the tray hidden, with the port and ah wrapper", () => {
  const ps = startScript(7420, "C:/x/tray.ps1", "C:/x/bin/ah.cmd")
  expect(ps).toContain("Start-Process powershell")
  expect(ps).toContain("-WindowStyle Hidden -PassThru).Id")
  expect(ps).toContain("'-File','C:/x/tray.ps1','-Port','7420','-Ah','C:/x/bin/ah.cmd'")
})

test("the start script quotes paths with spaces for the child, and apostrophes for PowerShell", () => {
  const ps = startScript(7420, "C:/Program Files/ah's/tray.ps1", "C:/x/ah.cmd")
  expect(ps).toContain(`'"C:/Program Files/ah''s/tray.ps1"'`)
})

test("only a tray script's command line counts as the tray", () => {
  expect(
    isTrayCommandLine("powershell -File C:/projects/ah/platform/tray.ps1 -Port 7420"),
  ).toEqual(true)
  expect(isTrayCommandLine("node ah.ts server serve")).toEqual(false)
  expect(isTrayCommandLine("")).toEqual(false)
})
