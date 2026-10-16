// Test harness: deterministic process lifecycle, disposable directories, and a read-only view of the application's own
// SQLite database (the independent observation path). Test-only; not used by the bridge.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const live = new Set();
const dirs = new Set();
const killAll = () => { for (const c of live) { try { c.kill("SIGKILL"); } catch {} } for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} } };
process.on("exit", killAll);
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { killAll(); process.exit(130); });

export function tempDir(prefix) { const d = mkdtempSync(join(tmpdir(), prefix)); dirs.add(d); return d; }
export function removeDir(d) { rmSync(d, { recursive: true, force: true }); dirs.delete(d); }

export const freePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.unref(); s.on("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = /** @type {any} */ (s.address()); s.close(() => resolve(port)); });
});

/** Spawns a process; `ready` resolves when `readyUrl` answers (any HTTP status) or a JSON ready line is printed. */
export async function startProcess(cmd, args, { env = {}, cwd, readyUrl, readyLine = false, timeoutMs = 60_000, name = cmd } = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  live.add(child);
  let out = "", err = "";
  child.stdout.on("data", (d) => { out += d; if (out.length > 200_000) out = out.slice(-100_000); });
  child.stderr.on("data", (d) => { err += d; if (err.length > 200_000) err = err.slice(-100_000); });
  const deadline = Date.now() + timeoutMs;
  let readyInfo = null;
  while (true) {
    if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode}: ${err.slice(-2000) || out.slice(-2000)}`);
    if (readyLine) { const line = out.split("\n").find((l) => l.startsWith("{") && l.includes('"ready"')); if (line) { readyInfo = JSON.parse(line); break; } }
    else if (readyUrl) { try { await fetch(readyUrl, { redirect: "manual", signal: AbortSignal.timeout(2000) }); break; } catch {} }
    if (Date.now() > deadline) { child.kill("SIGKILL"); throw new Error(`${name} not ready after ${timeoutMs}ms: ${err.slice(-2000)}`); }
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    child, ready: readyInfo, logs: () => ({ out, err }),
    async stop() {
      live.delete(child);
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((r) => { const t = setTimeout(() => { child.kill("SIGKILL"); r(undefined); }, 5000); child.once("exit", () => { clearTimeout(t); r(undefined); }); });
    }
  };
}

/** Opens the application's SQLite database READ-ONLY. Every query is a fresh read of what the application stored. */
export async function openOracle(path) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path, { readOnly: true });
  return { all: (sql, ...p) => db.prepare(sql).all(...p), get: (sql, ...p) => db.prepare(sql).get(...p), close: () => db.close() };
}

/** Minimal JSON HTTP client for seeding through the application's own API (test setup only). */
export async function http(base, method, path, { body, headers = {} } = {}) {
  const res = await fetch(new URL(path, base), { method, headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json, text };
}
