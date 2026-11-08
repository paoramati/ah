import { expect, test } from "vitest"
import { summarizeTracker } from "../../core/tracker_summary.ts"
import { ago, type HubWorkspace, renderMain, renderPage, shortRoot } from "./render.ts"

const NOW = Date.UTC(2026, 10, 8, 12)
const MIN = 60_000

test("ago", () => {
  expect(ago(NOW, NOW)).toEqual("just now")
  expect(ago(NOW - MIN, NOW)).toEqual("1 minute ago")
  expect(ago(NOW - 5 * MIN, NOW)).toEqual("5 minutes ago")
  expect(ago(NOW - 90 * MIN, NOW)).toEqual("1 hour ago")
  expect(ago(NOW - 5 * 60 * MIN, NOW)).toEqual("5 hours ago")
  expect(ago(NOW - 3 * 24 * 60 * MIN, NOW)).toEqual("3 days ago")
  expect(ago(NOW - 21 * 24 * 60 * MIN, NOW)).toEqual("3 weeks ago")
  expect(ago(NOW + MIN, NOW)).toEqual("just now")
})

test("shortRoot keeps the last two parts, either separator", () => {
  expect(shortRoot("C:/projects/ah")).toEqual("projects/ah")
  const BS = String.fromCharCode(92)
  expect(shortRoot(["C:", "Users", "me", "work", "app"].join(BS))).toEqual("work/app")
  expect(shortRoot("C:")).toEqual("C:")
})

const summary = summarizeTracker(
  `<h1>Port &lt;it&gt;</h1><p class="goal">Do it</p>
   <ah-item id="1" status="done"></ah-item><ah-item id="2" status="todo"></ah-item>
   <ah-item id="3" status="dropped"></ah-item>`,
)
const workspace = (over: Partial<HubWorkspace> = {}): HubWorkspace => ({
  root: "C:/projects/ah",
  active: [
    {
      path: "C:/projects/ah/n/index.html",
      url: "http://127.0.0.1:7421/view/html/x/",
      lastOpen: NOW - 5 * MIN,
      summary,
      current: true,
    },
  ],
  parked: [],
  done: [],
  ...over,
})

test("a tracker shows its title escaped, counts, progress and a link", () => {
  const html = renderMain([workspace()], NOW)
  expect(html).toContain('<a href="http://127.0.0.1:7421/view/html/x/">Port &lt;it&gt;</a>')
  expect(html).toContain("1 done")
  expect(html).toContain("1 to do")
  expect(html).toContain("1 dropped")
  expect(html).toContain("current")
  expect(html).toContain("5 minutes ago")
  // done / (total - dropped) = 1/2
  expect(html).toContain('aria-label="50% done"')
})

test("parked and done groups are collapsed, active is not", () => {
  const w = workspace()
  const html = renderMain([workspace({ parked: w.active, done: w.active })], NOW)
  expect(html).toContain("<h3>Active")
  expect(html).toContain('<details data-key="C:/projects/ah|parked">')
  expect(html).toContain('<details data-key="C:/projects/ah|done">')
})

test("an unreadable tracker still lists, without counts", () => {
  const w = workspace()
  w.active[0].summary = null
  const html = renderMain([w], NOW)
  expect(html).toContain("can't read")
  expect(html).not.toContain("pills")
})

test("no workspaces says how to start", () => {
  expect(renderMain([], NOW)).toContain("ah tracker add")
})

test("paths and titles can't break out of the page", () => {
  const w = workspace({ root: 'C:/x/"><script>alert(1)</script>' })
  expect(renderMain([w], NOW)).not.toContain("<script>alert")
  expect(renderPage([], NOW)).toContain("<title>Trackers</title>")
})
