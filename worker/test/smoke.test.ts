import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const anyEnv = env as never;

describe("worker skeleton", () => {
  it("responds on /healthz", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(new Request("http://localhost/healthz"), anyEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Service ready.");
  });

  it("returns 404 for unknown RPC paths", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://localhost/memos.api.v1.NoSuchService/NoSuchMethod", { method: "POST" }),
      anyEnv,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it("applies the D1 schema migration", async () => {
    const db = (env as { DB: D1Database }).DB;
    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' AND name != 'd1_migrations' ORDER BY name",
      )
      .all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toEqual([
      "attachment",
      "inbox",
      "memo",
      "memo_relation",
      "memo_share",
      "reaction",
      "system_setting",
      "user",
      "user_setting",
    ]);
  });
});
