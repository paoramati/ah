import { afterEach, expect, test, vi } from "vitest"
import type { AgentRef } from "./model.ts"
import { setCurrentTracker } from "./tracker_api.ts"

const agent: AgentRef = {
  harness: "claude",
  session: "s1",
  block: null,
  process: "claude-1",
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A server that answers current-tracker with `first` until an event has been posted */
function fakeServer(first: Response) {
  const calls: { path: string; body: any }[] = []
  let registered = false
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, body })
    if (path === "/core/event") {
      registered = true
      return Response.json({ context: null })
    }
    return registered ? Response.json({ path: body.path }) : first.clone()
  })
  return calls
}

test("tracker add registers a session the server doesn't know, then retries", async () => {
  const calls = fakeServer(new Response("this agent has no directory", { status: 409 }))
  const err = vi.spyOn(console, "error").mockImplementation(() => {})
  await setCurrentTracker(7420, agent, "C:/work/tracker.html")
  expect(calls.map((c) => c.path)).toEqual([
    "/core/current-tracker",
    "/core/event",
    "/core/current-tracker",
  ])
  expect(calls[1].body).toMatchObject({
    kind: "hook",
    event: "SessionStart",
    harness: "claude",
    session: "s1",
    block: null,
    process: "claude-1",
    cwd: process.cwd(),
  })
  expect(err).toHaveBeenCalledWith(expect.stringContaining("registered it from here"))
})

test("a session the server knows is not registered again", async () => {
  const calls = fakeServer(Response.json({ path: "C:/work/tracker.html" }))
  await setCurrentTracker(7420, agent, "C:/work/tracker.html")
  expect(calls.map((c) => c.path)).toEqual(["/core/current-tracker"])
})

test("other refusals are reported, not worked around", async () => {
  const calls = fakeServer(new Response("this pane isn't in Rex's tabs", { status: 409 }))
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("exit")
  }) as never)
  await expect(setCurrentTracker(7420, agent, "C:/work/tracker.html")).rejects.toThrow(
    "exit",
  )
  expect(calls.map((c) => c.path)).toEqual(["/core/current-tracker"])
})
