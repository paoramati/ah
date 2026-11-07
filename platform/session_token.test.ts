import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { addressAlive, currentAddress, parseAddress, postTo } from "./session.ts"

// Worker threads don't change what os.homedir() sees, so point the lookup at a temp dir
let configDirs: string[] = []
vi.mock("./paths.ts", async (original) => ({
  ...(await original<typeof import("./paths.ts")>()),
  claudeConfigDirs: () => configDirs,
}))

// The named pipe prefix, built without backslash literals
const BS = String.fromCharCode(92)
const PIPE = BS + BS + "." + BS + "pipe" + BS

// A named pipe on Windows, a unix socket elsewhere
const inboxPath = () => {
  const name = `ah-token-test-${process.pid}-${Math.random().toString(36).slice(2)}`
  return process.platform === "win32" ? PIPE + name : join(tmpdir(), `${name}.sock`)
}

async function withInbox(run: (socket: string) => Promise<void>): Promise<string[]> {
  const socket = inboxPath()
  const received: string[] = []
  const server = createServer((conn) => {
    let data = ""
    conn.on("data", (d) => (data += d))
    conn.on("end", () => received.push(data))
  })
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject)
    server.listen(socket, resolve)
  })
  try {
    await run(socket)
    await new Promise((r) => setTimeout(r, 50))
  } finally {
    server.close()
  }
  return received.join("").split("\n").filter(Boolean)
}

test("a post to a session with a token starts with the auth line", async () => {
  const lines = await withInbox((socket) =>
    postTo({ harness: "claude", socket, token: "tok-123" }, "hello"),
  )
  expect(lines.map((l) => JSON.parse(l))).toEqual([
    { type: "auth", token: "tok-123" },
    { type: "user", message: { role: "user", content: "hello" } },
  ])
})

test("a post without a token is just the message", async () => {
  const lines = await withInbox((socket) => postTo({ harness: "claude", socket }, "hello"))
  expect(lines.map((l) => JSON.parse(l))).toEqual([
    { type: "user", message: { role: "user", content: "hello" } },
  ])
})

test("the token travels with the address from the CLI to the server", () => {
  const saved = { ...process.env }
  try {
    process.env.CLAUDE_CODE_MESSAGING_SOCKET = PIPE + "x"
    process.env.CLAUDE_CODE_MESSAGING_TOKEN = "tok-abc"
    delete process.env.CODEX_THREAD_ID
    delete process.env.OPENCODE_SESSION_ID
    const address = currentAddress()
    expect(address).toEqual({ harness: "claude", socket: PIPE + "x", token: "tok-abc" })
    expect(parseAddress(JSON.parse(JSON.stringify(address)))).toEqual(address)
    delete process.env.CLAUDE_CODE_MESSAGING_TOKEN
    expect(currentAddress()).toEqual({ harness: "claude", socket: PIPE + "x" })
  } finally {
    process.env = saved
  }
})

test("a pipe is alive while a Claude session record names it", () => {
  const home = mkdtempSync(join(tmpdir(), "ah-pipe-home-"))
  try {
    configDirs = [join(home, ".claude")]
    const socket = PIPE + "cc-msg-alive-test"
    const address = { harness: "claude", socket } as const
    expect(addressAlive(address)).toEqual(false)
    mkdirSync(join(home, ".claude", "sessions"), { recursive: true })
    writeFileSync(
      join(home, ".claude", "sessions", "4242.json"),
      JSON.stringify({ pid: 4242, sessionId: "s", messagingSocketPath: socket }),
    )
    expect(addressAlive(address)).toEqual(true)
    expect(addressAlive({ harness: "claude", socket: PIPE + "other" })).toEqual(false)
  } finally {
    configDirs = []
    rmSync(home, { recursive: true, force: true })
  }
})
