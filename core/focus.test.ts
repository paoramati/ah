import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import {
  candidates,
  FOCUS_STALE_MS,
  isCurrent,
  lastAiTitle,
  matchWindow,
  stripGlyph,
  transcriptPath,
} from "./focus.ts"
import type { AgentRecord } from "./model.ts"

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ah-focus-"))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const line = (rec: object) => JSON.stringify(rec) + "\n"

test("lastAiTitle takes the last ai-title record", () => {
  const f = join(dir, "s.jsonl")
  writeFileSync(
    f,
    line({ type: "user", message: "hi" }) +
      line({ type: "ai-title", aiTitle: "First name" }) +
      line({ type: "assistant", message: "ok" }) +
      line({ type: "ai-title", aiTitle: "Second name" }),
  )
  expect(lastAiTitle(f)).toEqual("Second name")
})

test("lastAiTitle copes with no title, a missing file, and a cut first line", () => {
  const f = join(dir, "s.jsonl")
  writeFileSync(f, line({ type: "user", message: "hi" }))
  expect(lastAiTitle(f)).toEqual(null)
  expect(lastAiTitle(join(dir, "nope.jsonl"))).toEqual(null)
  writeFileSync(f, line({ type: "ai-title", aiTitle: "Only" }) + "x".repeat(300) + "\n")
  // The tail starts partway through the title line, so it is cut and skipped
  expect(lastAiTitle(f, 200)).toEqual(null)
  expect(lastAiTitle(f, 100_000)).toEqual("Only")
})

test("transcriptPath finds a session under any project", () => {
  mkdirSync(join(dir, "projects", "C--a"), { recursive: true })
  mkdirSync(join(dir, "projects", "C--b"), { recursive: true })
  writeFileSync(join(dir, "projects", "C--b", "abc.jsonl"), "")
  expect(transcriptPath("abc", [dir])).toEqual(join(dir, "projects", "C--b", "abc.jsonl"))
  expect(transcriptPath("zzz", [dir])).toEqual(null)
  expect(transcriptPath("abc", [join(dir, "none")])).toEqual(null)
})

test("stripGlyph takes off a leading status glyph and whitespace", () => {
  expect(stripGlyph("✳ Issue 8 tracker")).toEqual("Issue 8 tracker")
  expect(stripGlyph("⠐ Restarting the AH server")).toEqual("Restarting the AH server")
  expect(stripGlyph("Issue 8 tracker")).toEqual("Issue 8 tracker")
  expect(stripGlyph("  ")).toEqual("")
})

const cands = [
  { agent: "claude-1", title: "Issue 8 tracker" },
  { agent: "claude-2", title: "Task list" },
  { agent: "claude-3", title: null },
]

test("matchWindow finds the agent whose title is the window's, ignoring glyph and case", () => {
  expect(matchWindow("✳ Issue 8 tracker", cands)).toEqual("claude-1")
  expect(matchWindow("task LIST", cands)).toEqual("claude-2")
})

test("matchWindow says nothing for no match, an empty title, or two agents with one title", () => {
  expect(matchWindow("Windows PowerShell", cands)).toEqual(null)
  expect(matchWindow("", cands)).toEqual(null)
  expect(matchWindow("✳", cands)).toEqual(null)
  const twins = [...cands, { agent: "claude-4", title: "Task list" }]
  expect(matchWindow("Task list", twins)).toEqual(null)
})

test("candidates are the live Claude agents, titled from their sessions", () => {
  const agent = (over: Partial<AgentRecord>): AgentRecord =>
    ({ harness: "claude", session: "s", ended: false, ...over }) as AgentRecord
  const agents = new Map<string, AgentRecord>([
    ["claude-1", agent({ session: "a" })],
    ["claude-2", agent({ session: "b", ended: true })],
    ["codex-3", agent({ harness: "codex", session: "c" })],
  ])
  expect(candidates(agents, (s) => `title ${s}`)).toEqual([
    { agent: "claude-1", title: "title a" },
  ])
})

test("a report is current for a while, then stale", () => {
  const f = { agent: "claude-1", at: 1000 }
  expect(isCurrent(f, 1000 + FOCUS_STALE_MS - 1)).toEqual(true)
  expect(isCurrent(f, 1000 + FOCUS_STALE_MS)).toEqual(false)
})
