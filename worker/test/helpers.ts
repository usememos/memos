import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createClient, type Client } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import type { DescService } from "@bufbuild/protobuf";
import worker from "../src/index";
import type { Env } from "../src/env";

// Builds a Connect client whose fetch is routed straight into the Worker,
// impersonating `email` via the DEV_USER_EMAIL fallback (empty = anonymous).
export function makeClient<T extends DescService>(service: T, email: string): Client<T> {
  const testEnv: Env = { ...(env as unknown as Env), DEV_USER_EMAIL: email };
  const transport = createConnectTransport({
    baseUrl: "http://localhost",
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      // workerd rejects redirect: "error", which connect-web sets by default.
      const patched = { ...init, redirect: "manual" as const };
      const ctx = createExecutionContext();
      const response = await worker.fetch(new Request(input, patched), testEnv, ctx);
      await waitOnExecutionContext(ctx);
      return response;
    }) as typeof fetch,
  });
  return createClient(service, transport);
}
