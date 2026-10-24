// Independent AppPort consumer test for the Memos bridge.
// Real Memos server + real bridge process; the consumer uses only the published @appport/sdk. Every success is checked
// against Memos' own database, read directly; nothing is accepted on the bridge's word.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { startProcess, freePort, removeDir } from "../lib/harness.mjs";
import { discover, connect, invoke, verdict, losingFetch, isCallTo } from "../lib/consumer.mjs";
import { startMemos } from "./support/memos-app.mjs";

const BRIDGE = join(dirname(fileURLToPath(import.meta.url)), "..", "bridge.mjs");
let app, bridge, origin;

const startBridge = async (publish) => {
  const port = await freePort();
  return startProcess(process.execPath, [BRIDGE], { env: { APPPORT_BRIDGE_UPSTREAM: app.base, APPPORT_BRIDGE_PORT: String(port), APPPORT_BRIDGE_PUBLIC: publish ? "1" : "" }, readyLine: true, name: "bridge" });
};

before(async () => {
  app = await startMemos();
  bridge = await startBridge(true);
  origin = bridge.ready.url;
});
after(async () => { await bridge?.stop(); await app?.stop(); if (app) removeDir(app.work); });

test("the bridge refuses to start unless explicitly configured", async () => {
  await assert.rejects(startProcess(process.execPath, [BRIDGE], { env: { APPPORT_BRIDGE_UPSTREAM: "" }, readyLine: true, timeoutMs: 5000, name: "unconfigured" }), /APPPORT_BRIDGE_UPSTREAM is not set/);
});

test("discovery is opt-in: without APPPORT_BRIDGE_PUBLIC nothing is published", async () => {
  const quiet = await startBridge(false);
  try { assert.equal((await discover(quiet.ready.url)).state, "not-published"); } finally { await quiet.stop(); }
});

test("discovery: reference-verified, read-only capabilities advertised, nothing established", async () => {
  const found = await discover(origin);
  assert.equal(found.state, "reference-verified", found.reasons.join());
  assert.deepEqual(found.capabilities.map((c) => `${c.name}@${c.version}:${c.status}`).sort(), ["memos.get@1:verified", "memos.search@1:verified"]);
  for (const c of found.capabilities) {
    assert.equal(c.declared.effect, "observation");
    assert.deepEqual(c.declared.authorization, { scopes: ["memos.read"] });
  }
  assert.deepEqual(found.established, { publisherTrust: false, authorization: false, approval: false, invoked: false });
});

test("search returns exactly what Memos' own rules let bob see (independent DB check)", async () => {
  const client = await connect(origin, app.users.bob.credential);
  try {
    const out = await invoke(client, "memos.search", { text: "turnips" });
    const expected = app.observeVisible("bob", "turnips").sort();
    const got = out.output.memos.map((m) => m.name).sort();
    assert.equal(verdict(out, JSON.stringify(got) === JSON.stringify(expected)), "confirmed", `got ${got} expected ${expected}`);
    assert.ok(got.includes(app.notes.bobPrivate) && got.includes(app.notes.bobPublic));
    assert.ok(!got.includes(app.notes.carolPrivate), "carol's private note must not be visible to bob");
    for (const m of out.output.memos) {
      const row = app.observeMemo(m.name);
      assert.equal(m.creator, `users/${row.creator}`);
      assert.equal(m.visibility, row.visibility);
    }
  } finally { await client.close(); }
});

test("search by tag is resolved by Memos, not by the bridge", async () => {
  const client = await connect(origin, app.users.carol.credential);
  try {
    const out = await invoke(client, "memos.search", { tag: "alpha" });
    assert.deepEqual(out.output.memos.map((m) => m.name), [app.notes.carolPrivate]);
    const row = app.observeMemo(app.notes.carolPrivate);
    assert.equal(verdict(out, row.creator === "carol" && row.visibility === "PRIVATE"), "confirmed");
  } finally { await client.close(); }
});

test("get returns the stored memo, confirmed against Memos' database", async () => {
  const client = await connect(origin, app.users.bob.credential);
  try {
    const out = await invoke(client, "memos.get", { name: app.notes.bobPrivate });
    const row = app.observeMemo(app.notes.bobPrivate);
    const agrees = out.kind === "response" && out.output.content === row.content && out.output.visibility === row.visibility
      && out.output.creator === `users/${row.creator}` && Date.parse(out.output.createTime) / 1000 === Number(row.created_ts);
    assert.equal(verdict(out, agrees), "confirmed");
  } finally { await client.close(); }
});

test("authorization is Memos': carol cannot read bob's private memo (FORBIDDEN), although it exists", async () => {
  const client = await connect(origin, app.users.carol.credential);
  try {
    const out = await invoke(client, "memos.get", { name: app.notes.bobPrivate });
    assert.equal(out.kind, "denied"); assert.equal(out.code, "FORBIDDEN");
    assert.equal(app.observeMemo(app.notes.bobPrivate).creator, "bob", "the memo exists: this is a real denial, not a missing record");
  } finally { await client.close(); }
});

test("no credential: refused by AppPort before Memos is asked (UNAUTHORIZED)", async () => {
  const client = await connect(origin, undefined);
  try { const out = await invoke(client, "memos.search", { text: "turnips" }); assert.equal(out.kind, "denied"); assert.equal(out.code, "UNAUTHORIZED"); }
  finally { await client.close(); }
});

test("an invalid Memos token is rejected by Memos (UNAUTHORIZED); discovery granted nothing", async () => {
  const client = await connect(origin, "Bearer memos_pat_not-a-real-token");
  try { const out = await invoke(client, "memos.get", { name: app.notes.bobPublic }); assert.equal(out.kind, "denied"); assert.equal(out.code, "UNAUTHORIZED"); }
  finally { await client.close(); }
});

test("application-level failure: a memo that does not exist is NOT_FOUND, never success", async () => {
  const client = await connect(origin, app.users.bob.credential);
  try {
    const out = await invoke(client, "memos.get", { name: "memos/doesnotexist000" });
    assert.equal(verdict(out), "failed"); assert.equal(out.code, "NOT_FOUND");
    assert.equal(app.observeMemo("memos/doesnotexist000"), undefined);
  } finally { await client.close(); }
});

test("invalid input is rejected by the published contract before Memos is contacted", async () => {
  const client = await connect(origin, app.users.bob.credential);
  try {
    for (const input of [{ name: "../users/bob" }, { name: "memos/x\"y" }]) {
      const out = await invoke(client, "memos.get", input); assert.equal(out.code, "INVALID_INPUT");
    }
    assert.equal((await invoke(client, "memos.search", { pageSize: 500 })).code, "INVALID_INPUT");
  } finally { await client.close(); }
});

test("a lost response is indeterminate, never reported as a confirmed result, and is not retried", async () => {
  let posts = 0;
  const counting = async (url, init) => { if (isCallTo("memos.get")(String(url), init)) posts++; return losingFetch(isCallTo("memos.get"))(url, init); };
  const client = await connect(origin, app.users.bob.credential, { fetch: counting });
  try {
    const out = await invoke(client, "memos.get", { name: app.notes.bobPrivate });
    assert.equal(out.kind, "no-response");
    assert.equal(verdict(out, true), "indeterminate", "even a matching observation does not turn a lost answer into a confirmed one");
    assert.equal(posts, 1, "invoke() sends exactly once");
  } finally { await client.close(); }
});

test("cleanup: stopping removes the disposable Memos data", async () => {
  const work = app.work;
  await bridge.stop(); await app.stop(); removeDir(work);
  assert.equal(existsSync(work), false);
  bridge = null; app = null;
});
