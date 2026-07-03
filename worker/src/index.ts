import type { Env } from "./env";
import { createConnectFetchHandler } from "./connect/adapter";
import { registerServices } from "./connect/services";
import { resolveRequestContext } from "./auth/context";
import { handleFileRequest } from "./routes/file";
import { handleMcpRequest } from "./routes/mcp";
import { handlePublicContent } from "./routes/rss";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("Service ready.", { status: 200 });
    }

    if (url.pathname.startsWith("/memos.api.v1.")) {
      const requestContext = await resolveRequestContext(request, env);
      const handleRpc = createConnectFetchHandler((router) =>
        registerServices(router, {
          env,
          user: requestContext.user,
          waitUntil: (promise) => executionContext.waitUntil(promise),
        }),
      );
      const response = await handleRpc(request);
      if (response) {
        return response;
      }
      return new Response("Not Found", { status: 404 });
    }

    if (url.pathname.startsWith("/file/")) {
      const requestContext = await resolveRequestContext(request, env);
      const response = await handleFileRequest(request, env, requestContext);
      if (response) {
        return response;
      }
      return new Response("Not Found", { status: 404 });
    }

    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, env, executionContext);
    }

    const publicContent = await handlePublicContent(request, env);
    if (publicContent) {
      return publicContent;
    }

    // Everything else is served from static assets (SPA fallback configured
    // via assets.not_found_handling in wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
