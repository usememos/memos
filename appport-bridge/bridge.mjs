// Memos AppPort bridge: read-only capabilities over Memos' own HTTP API (/api/memos), called with the caller's own
// Memos personal access token. Memos decides visibility and access for every call; this process stores nothing.
//
//   APPPORT_BRIDGE_UPSTREAM=http://127.0.0.1:5230 [APPPORT_BRIDGE_PORT=4410] [APPPORT_BRIDGE_PUBLIC=1] node bridge.mjs
//
// Consumers send their Memos credential exactly as Memos expects it: `authorization: Bearer memos_pat_...`.

import { defineCapability, s } from "@appport/sdk";
import { startBridge, callApplication, runBridgeMain } from "./lib/bridge-kit.mjs";

const SCOPE = "memos.read";
const Visibility = s.enum(["PRIVATE", "PROTECTED", "PUBLIC"]);
const MemoName = s.string({ pattern: "^memos/[A-Za-z0-9_-]{1,64}$", description: "Memo resource name, e.g. memos/AbC123" });
const MemoSummary = {
  name: s.string(),
  creator: s.string({ description: "users/<username>" }),
  visibility: Visibility,
  state: s.string(),
  pinned: s.boolean(),
  tags: s.array(s.string()),
  snippet: s.string(),
  createTime: s.string(),
  updateTime: s.string()
};
const summary = (m) => ({ name: m.name, creator: m.creator, visibility: m.visibility, state: m.state, pinned: Boolean(m.pinned), tags: m.tags ?? [], snippet: m.snippet ?? "", createTime: m.createTime, updateTime: m.updateTime });

/** A CEL string literal for Memos' filter language. JSON escaping is valid CEL escaping for double-quoted strings. */
const celString = (v) => JSON.stringify(v);

export function capabilities(upstream) {
  const authority = "urn:appport:memos";
  const readOnly = (purpose) => ({ purpose, authority, approval: { required: false }, access: [{ resource: "urn:appport:memos:memos", mode: "reads" }] });

  const search = defineCapability({
    name: "memos.search", version: 1,
    description: "Search the memos the caller is allowed to see, by text and/or tag. Visibility is decided by Memos.",
    input: s.object({
      text: s.optional(s.string({ minLength: 1, maxLength: 200 })),
      tag: s.optional(s.string({ minLength: 1, maxLength: 64, pattern: "^[^\\s#]+$" })),
      pageSize: s.optional(s.integer({ minimum: 1, maximum: 50 })),
      pageToken: s.optional(s.string({ maxLength: 512 }))
    }),
    output: s.object({ memos: s.array(s.object(MemoSummary)), nextPageToken: s.string() }),
    effect: "observation",
    authorization: [SCOPE],
    authorizationContract: { required: true, scopes: [SCOPE] },
    integration: readOnly("Search memos visible to the caller."),
    handler: async ({ text, tag, pageSize, pageToken }, ctx) => {
      const clauses = [];
      if (text) clauses.push(`content.contains(${celString(text)})`);
      if (tag) clauses.push(`${celString(tag)} in tags`);
      const body = await callApplication(ctx, upstream, { path: "/api/memos", query: { filter: clauses.join(" && "), pageSize: pageSize ?? 20, pageToken } });
      return { memos: (body?.memos ?? []).map(summary), nextPageToken: body?.nextPageToken ?? "" };
    }
  });

  const get = defineCapability({
    name: "memos.get", version: 1,
    description: "Retrieve one memo, including its content, if Memos lets the caller see it.",
    input: s.object({ name: MemoName }),
    output: s.object({ ...MemoSummary, content: s.string() }),
    effect: "observation",
    authorization: [SCOPE],
    authorizationContract: { required: true, scopes: [SCOPE] },
    integration: readOnly("Retrieve a memo the caller may read."),
    handler: async ({ name }, ctx) => {
      const m = await callApplication(ctx, upstream, { path: `/api/${name}` }); // name is pattern-checked: memos/<uid>
      return { ...summary(m), content: m.content ?? "" };
    }
  });

  return [search, get];
}

export async function build(config) {
  const upstream = { baseUrl: config.upstream, headers: (credential) => ({ authorization: credential }) };
  return startBridge({
    application: { id: "com.usememos.memos", name: "Memos", version: "appport-bridge-1", description: "Memos notes, read through Memos' own API with the caller's own access token." },
    capabilities: capabilities(upstream),
    resources: [{ id: "urn:appport:memos:memos", kind: "collection", owner: "self", description: "Memos stored by this Memos instance." }],
    scopes: [SCOPE],
    publish: config.publish,
    publishCapabilities: [{ name: "memos.search", version: 1, purpose: true }, { name: "memos.get", version: 1, purpose: true }],
    host: config.host, port: config.port
  });
}

if (import.meta.url === `file://${process.argv[1]}`) await runBridgeMain(build);
