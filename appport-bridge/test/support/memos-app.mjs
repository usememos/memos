// Disposable Memos instance for the consumer test: real Memos server, SQLite in a temp dir, synthetic users and notes
// created through Memos' own API. Nothing here is used by the bridge.
//
// MEMOS_BIN=/path/to/memos   use a prebuilt binary; otherwise `go build ./cmd/memos` is run from the repository root.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { startProcess, freePort, tempDir, http, openOracle } from "../../lib/harness.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function memosBinary(work) {
  if (process.env.MEMOS_BIN) return process.env.MEMOS_BIN;
  const out = join(work, "memos");
  execFileSync("go", ["build", "-o", out, "./cmd/memos"], { cwd: REPO, stdio: "inherit" });
  return out;
}

export async function startMemos() {
  const work = tempDir("memos-appport-");
  const data = join(work, "data");
  execFileSync("mkdir", ["-p", data]);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = await startProcess(memosBinary(work), ["--data", data, "--port", String(port), "--addr", "127.0.0.1"], { readyUrl: `${base}/`, name: "memos", timeoutMs: 60_000 });

  // The first account becomes the instance admin. Admins bypass memo visibility on direct reads, so the identities the
  // test reasons about (bob, carol) are ordinary users and the admin is a throwaway.
  const users = {};
  for (const [username, password] of [["admin0", "synthetic-admin-pw-0"], ["bob", "synthetic-bob-pw-1"], ["carol", "synthetic-carol-pw-2"]]) {
    const created = await http(base, "POST", "/api/users", { body: { username, password } });
    if (created.status !== 200) throw new Error(`create ${username}: ${created.status}`);
    const signin = await http(base, "POST", "/api/auth/signin", { body: { passwordCredentials: { username, password } } });
    const pat = await http(base, "POST", `/api/users/${username}/personalAccessTokens`, { headers: { authorization: `Bearer ${signin.json.accessToken}` }, body: { description: "appport consumer test", expiresInDays: 1 } });
    if (!pat.json?.token) throw new Error(`token for ${username}: ${pat.status}`);
    users[username] = { username, credential: `Bearer ${pat.json.token}` };
  }

  const notes = {};
  const note = async (key, who, content, visibility) => {
    const r = await http(base, "POST", "/api/memos", { headers: { authorization: users[who].credential }, body: { content, visibility } });
    if (r.status !== 200) throw new Error(`memo ${key}: ${r.status}`);
    notes[key] = r.json.name;
  };
  await note("bobPrivate", "bob", "Synthetic note #alpha: water the turnips on Tuesday", "PRIVATE");
  await note("bobPublic", "bob", "Synthetic note #beta: turnips grow well in cool weather", "PUBLIC");
  await note("carolPrivate", "carol", "Synthetic note #alpha: carol's private turnips plan", "PRIVATE");

  const dbPath = join(data, "memos_prod.db");
  if (!existsSync(dbPath)) throw new Error(`expected Memos database at ${dbPath}`);
  const oracle = await openOracle(dbPath);
  return {
    base, users, notes, work,
    /** Independent observation: Memos' own `memo` table, read directly (read-only), joined to its creator. */
    observeMemo: (name) => oracle.get(
      `SELECT m.uid, u.username AS creator, m.content, m.visibility, m.row_status, m.pinned, m.created_ts, m.updated_ts
         FROM memo m JOIN user u ON u.id = m.creator_id WHERE m.uid = ?`, name.replace(/^memos\//, "")),
    /** What Memos' own rules say `username` may see among NORMAL memos whose content contains `text`. */
    observeVisible: (username, text) => oracle.all(
      `SELECT m.uid FROM memo m JOIN user u ON u.id = m.creator_id
        WHERE m.row_status = 'NORMAL' AND instr(m.content, ?) > 0 AND (u.username = ? OR m.visibility IN ('PUBLIC','PROTECTED'))`, text, username).map((r) => `memos/${r.uid}`),
    async stop() { oracle.close(); await proc.stop(); }
  };
}
