// A stand-in for a Claude session's inbox, for tests: a unix socket, or a
// named pipe on Windows, where a post must carry the session's token and
// starts with an auth line (see session.ts).

import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

// The named pipe prefix, built without backslash literals
const BS = String.fromCharCode(92)
const PIPE = BS + BS + "." + BS + "pipe" + BS

const TOKEN = "test-token"

export type InboxAddress = {
  harness: "claude"
  socket: string
  token?: string
}

/** Listens on a fresh socket (a pipe on Windows). `posts` has what each
 * connection wrote, without the auth line. `address` is what a session
 * directory would hold for it. */
/** A fresh socket path: a named pipe on Windows */
export function socketPath(dir: string): string {
  const name = `ah-inbox-${process.pid}-${Math.random().toString(36).slice(2)}`
  return process.platform === "win32" ? PIPE + name : join(dir || tmpdir(), `${name}.sock`)
}

/** The address for a socket from socketPath: Windows needs the token */
export function addressFor(socket: string): InboxAddress {
  return process.platform === "win32"
    ? { harness: "claude", socket, token: TOKEN }
    : { harness: "claude", socket }
}

export async function testInbox(dir: string) {
  const socket = socketPath(dir)
  const posts: string[] = []
  const server = createServer((conn) => {
    let text = ""
    conn.on("data", (chunk) => (text += chunk))
    conn.on("end", () => {
      const lines = text.split("\n").filter((l) => !isAuthLine(l))
      // A liveness probe connects and writes nothing
      if (lines.some((l) => l.trim())) posts.push(lines.join("\n"))
      conn.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject)
    server.listen(socket, resolve)
  })
  return { socket, address: addressFor(socket), posts, close: () => server.close() }
}

function isAuthLine(line: string): boolean {
  try {
    return JSON.parse(line).type === "auth"
  } catch {
    return false
  }
}
