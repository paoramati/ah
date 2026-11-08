import { expect, test } from "vitest"
import { summarizeTracker } from "./tracker_summary.ts"

const page = (body: string) => `<!doctype html><html><head><title>T &amp; Co</title></head>
<body><main>
  <h1>Port notes</h1>
  <p class="goal">Get it <b>working</b> on Windows.</p>
  <!-- Each item:
  <ah-item id="1" status="todo" rev=""><h3>Short title</h3></ah-item> -->
  ${body}
</main></body></html>`

test("counts items by status and ignores the example in the comment", () => {
  const s = summarizeTracker(
    page(`<ah-group name="Needed">
      <ah-item id="1" status="done" rev=""><h3>a</h3></ah-item>
      <ah-item id="2" status="todo" rev=""><h3>b</h3></ah-item>
      <ah-item id="3" rev="" status="todo"><h3>c</h3></ah-item>
      <ah-item id="4" status="hold" rev=""><h3>d</h3></ah-item>
    </ah-group>`),
  )
  expect(s.total).toEqual(4)
  expect(s.counts).toEqual({
    todo: 2,
    doing: 0,
    question: 0,
    hold: 1,
    done: 1,
    dropped: 0,
  })
})

test("title is the h1, goal has its markup stripped", () => {
  const s = summarizeTracker(page(""))
  expect(s.title).toEqual("Port notes")
  expect(s.goal).toEqual("Get it working on Windows.")
  expect(s.total).toEqual(0)
})

test("falls back to the title element, then the fallback", () => {
  expect(summarizeTracker("<title>T &amp; Co</title>").title).toEqual("T & Co")
  expect(summarizeTracker("<p>nothing</p>", "x.html").title).toEqual("x.html")
})

test("an unknown status counts toward the total only", () => {
  const s = summarizeTracker(`<ah-item id="1" status="weird"></ah-item>`)
  expect(s.total).toEqual(1)
  expect(Object.values(s.counts).reduce((a, b) => a + b, 0)).toEqual(0)
})
