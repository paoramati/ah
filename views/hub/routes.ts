// The hub's routes, under /view/hub/: one page listing every workspace's
// trackers with item counts, and the same body alone at ?fragment=1 for the
// page to refresh itself with. It stands in for the dashboard on platforms
// without one (#21): no follow-focus, but every tracker at a glance.

import type { Core } from "../../core/core.ts"
import { readTrackerSummary } from "../../core/tracker_summary.ts"
import type { TrackerEntry } from "../../core/model.ts"
import type { HtmlBackend } from "../html/routes.ts"
import { type HubTracker, type HubWorkspace, renderMain, renderPage } from "./render.ts"

export class Hub {
  #core: Core
  #html: HtmlBackend

  constructor(core: Core, html: HtmlBackend) {
    this.#core = core
    this.#html = html
  }

  /** Every workspace's trackers, read from their files now */
  workspaces(): HubWorkspace[] {
    const tracker = (e: TrackerEntry, current: string | null): HubTracker[] => {
      if (!("path" in e.subject)) return []
      const { path } = e.subject
      return [
        {
          path,
          url: this.#html.files.info(path).url,
          lastOpen: e.lastOpen,
          summary: readTrackerSummary(path),
          current: path === current,
        },
      ]
    }
    return this.#core.trackers.workspaces().map((w) => {
      const current = w.current && "path" in w.current ? w.current.path : null
      const list = (entries: TrackerEntry[]) => entries.flatMap((e) => tracker(e, current))
      return {
        root: w.root,
        active: list(w.active),
        parked: list(w.parked),
        done: list(w.done),
      }
    })
  }

  async handle(req: Request, rest: string): Promise<Response> {
    if (rest !== "") return new Response("not found", { status: 404 })
    const url = new URL(req.url)
    const workspaces = this.workspaces()
    const headers = { "cache-control": "no-store" }
    if (url.searchParams.has("fragment")) {
      return new Response(renderMain(workspaces), {
        headers: { ...headers, "content-type": "text/html; charset=utf-8" },
      })
    }
    return new Response(renderPage(workspaces), {
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    })
  }
}
