// Bridge kit: manifest extensions and attributes are published exactly as given, and declare nothing about callers.
// No Memos server is needed: the declarations are checked in the manifest, and calls go to an unreachable upstream.

import { test } from "node:test";
import assert from "node:assert/strict";
import { defineCapability, s } from "@appport/sdk";
import { startBridge } from "../lib/bridge-kit.mjs";
import { connect, invoke } from "../lib/consumer.mjs";

const capability = defineCapability({
  name: "kit.echo", version: 1, input: s.object({}), output: s.object({}), effect: "observation",
  authorization: ["kit.read"], authorizationContract: { required: true, scopes: ["kit.read"] },
  handler: async () => { throw new Error("not called"); }
});
const options = { application: { id: "com.example.kit", name: "Kit", version: "1" }, capabilities: [capability], scopes: ["kit.read"], publish: false, publishCapabilities: [] };
const declaration = { "example.declaration/1": { capabilities: { "kit.echo@1": [{ note: "declared" }] } } };

test("extensions and attributes are published in the manifest as given", async () => {
  const running = await startBridge({ ...options, extensions: ["example.declaration/1"], attributes: declaration });
  try {
    const client = await connect(running.url, "Bearer any");
    assert.ok(client.manifest.extensions.includes("example.declaration/1"));
    assert.deepEqual(client.manifest.attributes["example.declaration/1"], declaration["example.declaration/1"]);
    await client.close();
  } finally { await running.close(); }
});

test("without them, the manifest carries none (unchanged behavior)", async () => {
  const running = await startBridge(options);
  try {
    const client = await connect(running.url, "Bearer any");
    assert.equal(client.manifest.attributes?.["example.declaration/1"], undefined);
    assert.ok(!(client.manifest.extensions ?? []).includes("example.declaration/1"));
    await client.close();
  } finally { await running.close(); }
});

test("a declaration grants nothing: an anonymous caller is still refused", async () => {
  const running = await startBridge({ ...options, extensions: ["example.declaration/1"], attributes: declaration });
  try {
    const client = await connect(running.url, undefined);
    assert.equal((await invoke(client, "kit.echo", {})).code, "UNAUTHORIZED");
    await client.close();
  } finally { await running.close(); }
});

test("the integration descriptor key stays reserved", async () => {
  await assert.rejects(startBridge({ ...options, attributes: { "appport.integration/1": {} } }), /reserved/);
});
