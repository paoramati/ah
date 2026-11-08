// Which agent's terminal window is in front (#21). A watcher script
// (platform/focus_win.ps1) reports the title of the foreground terminal
// window. Windows Terminal runs every window in one process, so the process
// tree can't say which agent a window is, but Claude Code puts the session's
// title in the window title and writes the same title to its transcript, so
// the title says which session it is.
//
// Titles are only matched here, in memory: never logged, never stored.

import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from "node:fs"
import { join } from "node:path"
import { claudeConfigDirs } from "../platform/paths.ts"
import type { AgentId, AgentRecord } from "./model.ts"

/** How long a report counts as current, ms. A focus on something else (a
 * browser, an editor) doesn't report, so the last terminal stays for this
 * long and is then marked stale. */
export const FOCUS_STALE_MS = 30_000

export interface Focused {
  agent: AgentId
  /** When it was last reported in front, ms since the epoch */
  at: number
}

/** The title Claude Code gave a session: the last ai-title record in its
 * transcript, or null. Reads only the end of the file. */
export function lastAiTitle(file: string, tailBytes = 256 * 1024): string | null {
  let fd: number | null = null
  try {
    fd = openSync(file, "r")
    const size = statSync(file).size
    const start = Math.max(0, size - tailBytes)
    const buf = Buffer.alloc(size - start)
    readSync(fd, buf, 0, buf.length, start)
    const lines = buf.toString("utf8").split("\n")
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"ai-title"')) continue
      try {
        const rec = JSON.parse(lines[i]) as {
          type?: string
          aiTitle?: unknown
        }
        if (rec.type === "ai-title" && typeof rec.aiTitle === "string") return rec.aiTitle
      } catch {
        // a line cut by the tail's start, or half-written: keep looking
      }
    }
    return null
  } catch {
    return null
  } finally {
    if (fd !== null) closeSync(fd)
  }
}

/** A session's transcript, <config>/projects/<project>/<session>.jsonl, in any
 * of the config dirs */
export function transcriptPath(
  session: string,
  dirs: string[] = claudeConfigDirs(),
): string | null {
  for (const dir of dirs) {
    const projects = join(dir, "projects")
    if (!existsSync(projects)) continue
    for (const project of readdirSync(projects)) {
      const file = join(projects, project, `${session}.jsonl`)
      if (existsSync(file)) return file
    }
  }
  return null
}

/** A window title with the status glyph Claude Code puts in front of it (a
 * spinner or star) and the whitespace around it taken off */
export function stripGlyph(title: string): string {
  // Leading characters that aren't letters, digits or opening punctuation
  return title.replace(/^[^\p{L}\p{N}"'([]+/u, "").trim()
}

export interface Candidate {
  agent: AgentId
  /** Its session's title, from the transcript */
  title: string | null
}

/** The agent whose title is the window's. null when none matches, or when more
 * than one does, since a wrong highlight is worse than none. */
export function matchWindow(windowTitle: string, candidates: Candidate[]): AgentId | null {
  const shown = stripGlyph(windowTitle).toLowerCase()
  if (!shown) return null
  const hits = candidates.filter(
    (c) => c.title && stripGlyph(c.title).toLowerCase() === shown,
  )
  return hits.length === 1 ? hits[0].agent : null
}

/** The live agents, with their titles read from their transcripts */
export function candidates(
  agents: Map<AgentId, AgentRecord>,
  titleOf: (session: string) => string | null = (s) => {
    const file = transcriptPath(s)
    return file ? lastAiTitle(file) : null
  },
): Candidate[] {
  return [...agents]
    .filter(([, a]) => a.harness === "claude" && !a.ended)
    .map(([agent, a]) => ({ agent, title: titleOf(a.session) }))
}

/** Whether a focus report is still current */
export const isCurrent = (focused: Focused, now = Date.now()) =>
  now - focused.at < FOCUS_STALE_MS
