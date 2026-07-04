import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { DescService } from "@bufbuild/protobuf";
import { Code, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";
import { normalizeTeamDomain } from "../src/auth/access";
import { AuthService } from "../src/gen/api/v1/auth_service_pb";
import { MemoService } from "../src/gen/api/v1/memo_service_pb";

describe("normalizeTeamDomain", () => {
  it("accepts the bare team slug", () => {
    expect(normalizeTeamDomain("yugai")).toBe("yugai");
  });

  it("strips a full cloudflareaccess.com host", () => {
    expect(normalizeTeamDomain("yugai.cloudflareaccess.com")).toBe("yugai");
  });

  it("strips protocol and trailing path", () => {
    expect(normalizeTeamDomain("https://yugai.cloudflareaccess.com/")).toBe("yugai");
    expect(normalizeTeamDomain("  https://yugai.cloudflareaccess.com/cdn-cgi/access/certs  ")).toBe("yugai");
  });
});

// A garbage header degrades to anonymous instead of 500ing the whole request:
// Access only ever forwards Cf-Access-Jwt-Assertion after validating it
// itself, so a verification failure on our side means our own config is out
// of sync (stale ACCESS_AUD, JWKS hiccup, etc.), not a forged token — and
// should never take public content down with it.
function makeClientWithBadJwt<T extends DescService>(service: T): ReturnType<typeof createClient<T>> {
  const testEnv: Env = { ...(env as unknown as Env), DEV_USER_EMAIL: "" };
  const transport = createConnectTransport({
    baseUrl: "http://localhost",
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Cf-Access-Jwt-Assertion", "not-a-real-jwt");
      const patched = { ...init, headers, redirect: "manual" as const };
      const ctx = createExecutionContext();
      const response = await worker.fetch(new Request(input, patched), testEnv, ctx);
      await waitOnExecutionContext(ctx);
      return response;
    }) as typeof fetch,
  });
  return createClient(service, transport);
}

describe("Access JWT verification failure", () => {
  it("degrades to anonymous instead of 500ing the request", async () => {
    const client = makeClientWithBadJwt(AuthService);
    // Unauthenticated (proper anonymous handling), not Internal/Unknown from a crash.
    await expect(client.getCurrentUser({})).rejects.toMatchObject({ code: Code.Unauthenticated });
  });

  it("still serves public memos when the header fails verification", async () => {
    const memoClient = makeClientWithBadJwt(MemoService);
    const list = await memoClient.listMemos({});
    expect(list).toBeDefined();
    expect(Array.isArray(list.memos)).toBe(true);
  });
});
