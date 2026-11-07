// The CLI's client for the core's tracker routes (core.ts): a workspace's
// current tracker, its list, and parking or finishing one. Trackers are kept
// in the registry, which the server owns (trackers.ts), so these need it
// running.

import { callServer, die, serverJson, serverUrl } from "../platform/cli.ts"
import { status } from "../platform/server.ts"
import { registerSession } from "./hook.ts"
import type { AgentRef, TrackerEntry, TrackerStatus, WorkspaceTrackers } from "./model.ts"

const postJson = <T>(port: number, rest: string, body: unknown) =>
  callServer<T>(serverUrl(port, `core/${rest}`), { body })

/** Post to a route that works out the agent's workspace. If the server says it
 * doesn't know this agent's directory, as when its hooks never reported,
 * register the session from here once and try again. */
async function postAsAgent<T>(port: number, rest: string, body: object): Promise<T> {
  const call = () =>
    fetch(serverUrl(port, `core/${rest}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  let res = await call()
  const agent = (body as { agent: AgentRef }).agent
  if (res.status === 409 && (await res.clone().text()).includes("no directory")) {
    if (await registerSession(port, agent)) {
      console.error(
        "ah: the server didn't know this session (its hooks hadn't reported); registered it from here",
      )
      res = await call()
    }
  }
  if (!res.ok) die(`ah: ${(await res.text()).trim()}`)
  return await serverJson<T>(res)
}

/** Make `path` the agent's workspace's current tracker */
export async function setCurrentTracker(port: number, agent: AgentRef, path: string) {
  await postAsAgent(port, "current-tracker", { agent, path })
}

/** The agent's workspace's current tracker, or null if it has none or the
 * server isn't running */
export async function currentTracker(
  port: number,
  agent: AgentRef,
): Promise<string | null> {
  if (!(await status(port))) return null
  return (await postAsAgent<{ path: string | null }>(port, "current-tracker", { agent }))
    .path
}

/** The trackers of the workspace `dir` is in, finished ones included */
export async function workspaceTrackers(port: number, dir: string) {
  const url = new URL(serverUrl(port, "core/trackers"))
  url.searchParams.set("dir", dir)
  return await callServer<WorkspaceTrackers & { root: string; done: TrackerEntry[] }>(url)
}

/** Park or finish the tracker at `path`. Returns its path as the server has it. */
export async function setTrackerStatus(
  port: number,
  path: string,
  to: Exclude<TrackerStatus, "active">,
): Promise<string> {
  return (await postJson<{ path: string }>(port, "tracker-status", { status: to, path }))
    .path
}
