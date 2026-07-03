import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";
import type { Env } from "../src/env";
import { AuthService } from "../src/gen/api/v1/auth_service_pb";
import { MemoService, Visibility } from "../src/gen/api/v1/memo_service_pb";
import { UserService, UserNotification_Status, UserNotification_Type } from "../src/gen/api/v1/user_service_pb";
import { makeClient } from "./helpers";

const ALICE = "alice@example.com";
const BOB = "bob@example.com";

(env as { ADMIN_EMAILS: string }).ADMIN_EMAILS = "";

async function provision(email: string): Promise<void> {
  await makeClient(AuthService, email).getCurrentUser({});
}

async function fetchPath(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`http://localhost${path}`, init), env as unknown as Env, ctx);
  const body = await response.arrayBuffer();
  await waitOnExecutionContext(ctx);
  return new Response(body, { status: response.status, headers: response.headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhooks", () => {
  it("manages webhooks and dispatches signed events on memo creation", async () => {
    await provision(ALICE);
    const userClient = makeClient(UserService, ALICE);
    const webhook = await userClient.createUserWebhook({
      parent: "users/alice",
      webhook: { url: "https://hooks.example.com/x", displayName: "test" },
    });
    expect(webhook.signingSecretSet).toBe(true);

    const { signingSecret } = await userClient.getUserWebhookSigningSecret({ name: webhook.name });
    expect(signingSecret).toMatch(/^whsec_/);

    const dispatched: { url: string; headers: Headers; body: string }[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      dispatched.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: String(init?.body),
      });
      return new Response("ok");
    });

    const memoClient = makeClient(MemoService, ALICE);
    await memoClient.createMemo({ memo: { content: "hook me", visibility: Visibility.PRIVATE } });
    // waitUntil promises resolve within the test execution context via helpers.
    await vi.waitFor(() => expect(dispatched.length).toBe(1));
    fetchSpy.mockRestore();

    expect(dispatched[0]!.url).toBe("https://hooks.example.com/x");
    expect(dispatched[0]!.headers.get("webhook-signature")).toMatch(/^v1,/);
    const payload = JSON.parse(dispatched[0]!.body) as { activityType: string; memo: { content: string } };
    expect(payload.activityType).toBe("memos.memo.created");
    expect(payload.memo.content).toBe("hook me");

    await userClient.deleteUserWebhook({ name: webhook.name });
    const after = await userClient.listUserWebhooks({ parent: "users/alice" });
    expect(after.webhooks).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("creates an inbox entry when someone comments", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(MemoService, ALICE);
    const bob = makeClient(MemoService, BOB);
    const memo = await alice.createMemo({ memo: { content: "пост", visibility: Visibility.PUBLIC } });
    await bob.createMemoComment({ name: memo.name, comment: { content: "привет!", visibility: Visibility.PUBLIC } });

    const aliceUser = makeClient(UserService, ALICE);
    const notifications = await vi.waitFor(async () => {
      const result = await aliceUser.listUserNotifications({ parent: "users/alice" });
      expect(result.notifications.length).toBe(1);
      return result.notifications;
    });
    expect(notifications[0]!.type).toBe(UserNotification_Type.MEMO_COMMENT);
    expect(notifications[0]!.sender).toBe("users/bob");
    expect(notifications[0]!.status).toBe(UserNotification_Status.UNREAD);

    const updated = await aliceUser.updateUserNotification({
      notification: { name: notifications[0]!.name, status: UserNotification_Status.ARCHIVED },
      updateMask: { paths: ["status"] },
    });
    expect(updated.status).toBe(UserNotification_Status.ARCHIVED);

    await aliceUser.deleteUserNotification({ name: notifications[0]!.name });
    const after = await aliceUser.listUserNotifications({ parent: "users/alice" });
    expect(after.notifications).toHaveLength(0);
  });

  it("creates a mention notification", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(MemoService, ALICE);
    await alice.createMemo({ memo: { content: "пинг @bob посмотри", visibility: Visibility.PROTECTED } });
    const bobUser = makeClient(UserService, BOB);
    const notifications = await vi.waitFor(async () => {
      const result = await bobUser.listUserNotifications({ parent: "users/bob" });
      expect(result.notifications.length).toBe(1);
      return result.notifications;
    });
    expect(notifications[0]!.type).toBe(UserNotification_Type.MEMO_MENTION);
  });
});

describe("public content routes", () => {
  it("serves robots.txt, sitemap and RSS with public memos only", async () => {
    await provision(ALICE);
    const alice = makeClient(MemoService, ALICE);
    await alice.createMemo({ memo: { content: "# Публичный пост\n\nтекст", visibility: Visibility.PUBLIC } });
    await alice.createMemo({ memo: { content: "секрет", visibility: Visibility.PRIVATE } });

    const robots = await fetchPath("/robots.txt");
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await fetchPath("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(await sitemap.text()).toContain("/memos/");

    const rss = await fetchPath("/explore/rss.xml");
    expect(rss.status).toBe(200);
    const rssText = await rss.text();
    expect(rssText).toContain("Публичный пост");
    expect(rssText).not.toContain("секрет");
    expect(rssText).toContain("<h1>");

    const userRss = await fetchPath("/u/alice/rss.xml");
    expect(userRss.status).toBe(200);
    expect(await fetchPath("/u/nobody/rss.xml").then((r) => r.status)).toBe(404);
  });
});

describe("MCP endpoint", () => {
  async function mcpCall(body: unknown, email = ALICE): Promise<Record<string, unknown>> {
    const testEnv: Env = { ...(env as unknown as Env), DEV_USER_EMAIL: email };
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }),
      testEnv,
      ctx,
    );
    const json = response.status === 202 ? {} : ((await response.json()) as Record<string, unknown>);
    await waitOnExecutionContext(ctx);
    return json;
  }

  it("initializes and lists curated tools", async () => {
    const init = await mcpCall({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect((init.result as { serverInfo: { name: string } }).serverInfo.name).toBe("memos");

    const list = await mcpCall({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = (list.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(tools).toContain("memo_list_memos");
    expect(tools).toContain("memo_create_memo");
    expect(tools).toContain("auth_get_current_user");
    expect(tools).not.toContain("user_delete_user");
  });

  it("creates and lists memos through tool calls", async () => {
    await provision(ALICE);
    const created = await mcpCall({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "memo_create_memo", arguments: { memo: { content: "из MCP #mcp", visibility: "PRIVATE" } } },
    });
    const createdResult = created.result as { isError: boolean; content: { text: string }[] };
    expect(createdResult.isError).toBe(false);
    expect(JSON.parse(createdResult.content[0]!.text).content).toBe("из MCP #mcp");

    const listed = await mcpCall({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "memo_list_memos", arguments: { filter: 'tag in ["mcp"]' } },
    });
    const listedResult = listed.result as { isError: boolean; content: { text: string }[] };
    const memos = JSON.parse(listedResult.content[0]!.text).memos as { content: string }[];
    expect(memos).toHaveLength(1);
  });

  it("returns tool errors for anonymous callers", async () => {
    const result = await mcpCall(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "memo_create_memo", arguments: { memo: { content: "x" } } } },
      "",
    );
    expect((result.result as { isError: boolean }).isError).toBe(true);
  });
});
