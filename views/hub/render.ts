// The hub page's HTML: every workspace's trackers, with how far along each is.
// Pure, so it can be tested; routes.ts feeds it from the core and serves it.

import { escapeHtml as h } from "../escape.ts"
import {
  ITEM_STATUSES,
  type ItemStatus,
  type TrackerSummary,
} from "../../core/tracker_summary.ts"

export interface HubTracker {
  path: string
  /** Where its page is */
  url: string
  lastOpen: number
  /** null if the file couldn't be read */
  summary: TrackerSummary | null
  current: boolean
}

export interface HubWorkspace {
  root: string
  active: HubTracker[]
  parked: HubTracker[]
  done: HubTracker[]
}

/** just now, 3 minutes ago, 2 hours ago, 5 days ago, 3 weeks ago */
export function ago(then: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)
  if (minutes < 1) return "just now"
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`
  if (minutes < 60) return plural(minutes, "minute")
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, "hour")
  const days = Math.floor(hours / 24)
  return days < 14 ? plural(days, "day") : plural(Math.floor(days / 7), "week")
}

/** The last two parts of a path: where a workspace is, without the whole drive */
export function shortRoot(root: string): string {
  const parts = root.split(/[\\/]+/).filter(Boolean)
  return parts.length <= 2 ? root : parts.slice(-2).join("/")
}

const LABELS: Record<ItemStatus, string> = {
  todo: "to do",
  doing: "doing",
  question: "question",
  hold: "hold",
  done: "done",
  dropped: "dropped",
}

function pills(summary: TrackerSummary): string {
  const shown = ITEM_STATUSES.filter((s) => summary.counts[s] > 0)
  if (!shown.length) return `<span class="pill none">no items</span>`
  return shown
    .map((s) => `<span class="pill ${s}">${summary.counts[s]} ${LABELS[s]}</span>`)
    .join("")
}

function progress(summary: TrackerSummary): string {
  // Dropped items aren't work that was left
  const work = summary.total - summary.counts.dropped
  if (work <= 0) return ""
  const pct = Math.round((summary.counts.done / work) * 100)
  return `<div class="bar" role="img" aria-label="${pct}% done"><div style="width:${pct}%"></div></div>`
}

function row(t: HubTracker, now: number): string {
  const s = t.summary
  const title = s?.title ?? "(can't read this file)"
  const open = `<a href="${h(t.url)}">${h(title)}</a>`
  return `<li class="tracker${t.current ? " current" : ""}">
  <div class="head">${open}${t.current ? `<span class="tag">current</span>` : ""}<span class="when">${h(ago(t.lastOpen, now))}</span></div>
  ${s?.goal ? `<p class="goal">${h(s.goal)}</p>` : ""}
  ${s ? `<div class="pills">${pills(s)}</div>${progress(s)}` : ""}
</li>`
}

function group(label: string, key: string, list: HubTracker[], now: number, open: boolean) {
  if (!list.length) return ""
  const body = `<ul>${list.map((t) => row(t, now)).join("")}</ul>`
  // Parked and done ones are collapsed, with the page's own memory of which
  // are open kept by the refresh script (data-key)
  return open
    ? `<section><h3>${h(label)} <span class="n">${list.length}</span></h3>${body}</section>`
    : `<details data-key="${h(key)}"><summary>${h(label)} <span class="n">${list.length}</span></summary>${body}</details>`
}

/** The body of the page, which the page's script also swaps in on refresh */
export function renderMain(workspaces: HubWorkspace[], now = Date.now()): string {
  if (!workspaces.length) {
    return `<p class="empty">No trackers yet. Run <code>ah tracker add &lt;file&gt;</code> from a session to start one.</p>`
  }
  return workspaces
    .map(
      (w) => `<article class="workspace">
  <h2 title="${h(w.root)}">${h(shortRoot(w.root))}</h2>
  ${group("Active", `${w.root}|active`, w.active, now, true)}
  ${group("Parked", `${w.root}|parked`, w.parked, now, false)}
  ${group("Done", `${w.root}|done`, w.done, now, false)}
</article>`,
    )
    .join("\n")
}

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--card:#f6f8fa;--accent:#0969da;--ok:#1a7f37}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--card:#161b22;--accent:#4493f8;--ok:#3fb950}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;align-items:baseline;gap:12px;margin-bottom:8px}
h1{font-size:22px;margin:0}
.sub{color:var(--muted);font-size:13px}
.workspace{margin-top:28px}
h2{font-size:15px;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:600}
h3,summary{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:14px 0 6px;cursor:default}
summary{cursor:pointer}
.n{font-weight:400}
ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tracker{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.tracker.current{border-color:var(--accent)}
.head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.head a{color:var(--accent);font-weight:600;text-decoration:none}
.head a:hover{text-decoration:underline}
.tag{font-size:11px;border:1px solid var(--accent);color:var(--accent);border-radius:99px;padding:0 6px}
.when{margin-left:auto;color:var(--muted);font-size:12px}
.goal{margin:4px 0 0;color:var(--muted);font-size:13px}
.pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.pill{font-size:12px;border-radius:99px;padding:1px 8px;border:1px solid var(--line);color:var(--muted)}
.pill.doing{color:var(--accent);border-color:var(--accent)}
.pill.done{color:var(--ok);border-color:var(--ok)}
.pill.question{color:#bf8700;border-color:#bf8700}
.bar{height:4px;background:var(--line);border-radius:2px;margin-top:8px;overflow:hidden}
.bar>div{height:100%;background:var(--ok)}
.empty{color:var(--muted);margin-top:32px}
code{background:var(--card);padding:1px 5px;border-radius:4px}
@media (max-width:520px){.when{margin-left:0;width:100%}}
`

// Swaps <main>'s content for the server's, keeping which groups are open
const SCRIPT = `
const main = document.querySelector("main #list")
const open = () => new Set([...document.querySelectorAll("details[open]")].map((d) => d.dataset.key))
async function refresh() {
  try {
    const res = await fetch("?fragment=1", { cache: "no-store" })
    if (!res.ok) return
    const html = await res.text()
    const keep = open()
    main.innerHTML = html
    for (const d of main.querySelectorAll("details")) if (keep.has(d.dataset.key)) d.open = true
  } catch {}
}
setInterval(() => { if (!document.hidden) refresh() }, 5000)
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh() })
`

export function renderPage(workspaces: HubWorkspace[], now = Date.now()): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trackers</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <header><h1>Trackers</h1><span class="sub">every workspace, refreshed live</span></header>
  <div id="list">${renderMain(workspaces, now)}</div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`
}
