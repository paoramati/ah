// What the hub page shows about a tracker, read from its HTML file: its
// title and goal, and how many items are in each status. The template starts
// with an HTML comment holding an example item, which isn't one.

import { readFileSync } from "node:fs"

export const ITEM_STATUSES = [
  "todo",
  "doing",
  "question",
  "hold",
  "done",
  "dropped",
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export interface TrackerSummary {
  title: string
  goal: string
  counts: Record<ItemStatus, number>
  /** All items */
  total: number
}

const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

/** A tracker's summary from its HTML text */
export function summarizeTracker(html: string, fallbackTitle = "Tracker"): TrackerSummary {
  const text = html.replace(/<!--[\s\S]*?-->/g, "")
  const counts = Object.fromEntries(ITEM_STATUSES.map((s) => [s, 0])) as Record<
    ItemStatus,
    number
  >
  let total = 0
  for (const m of text.matchAll(/<ah-item\b[^>]*?\bstatus="([^"]*)"/g)) {
    total++
    const status = m[1] as ItemStatus
    if (status in counts) counts[status]++
  }
  const h1 = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]
  const goal = text.match(/<p\b[^>]*\bclass="goal"[^>]*>([\s\S]*?)<\/p>/)?.[1]
  return {
    title: decode(h1 ?? title ?? "") || fallbackTitle,
    goal: decode(goal ?? ""),
    counts,
    total,
  }
}

/** The summary of the tracker at `path`, or null if it can't be read */
export function readTrackerSummary(path: string): TrackerSummary | null {
  try {
    return summarizeTracker(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}
