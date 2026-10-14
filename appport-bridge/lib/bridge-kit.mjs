// AppPort bridge kit (trusted-boundary mode, @appport/server README).
//
// A bridge is a small, stateless AppPort server, built only from the published @appport/* packages, that exposes a few
// capabilities of an EXISTING application by calling that application's own public API with the CALLER's own application
// credential. The application stays authoritative for data, validation and permissions; the bridge stores nothing, decides
// nothing and never widens access:
//
//   * AppPort authentication only notes WHETHER the caller presented an application credential. Anonymous callers are
//     refused by AppPort itself (UNAUTHORIZED) before the application is contacted.
//   * Every capability call is forwarded with the caller's credential; the application's answer (401/403/404/...) is
//     mapped to the matching AppPort error. The bridge has no credential of its own.
//   * Credentials and application payloads are never logged.

import { createHash, randomUUID } from "node:crypto";
import { createApplication, createServer, permissionAuthorizer, errors, AppPortError } from "@appport/sdk";
import { serve } from "@appport/sdk/node";

const CREDENTIAL = "appport.bridge.credential"; // session attribute holding the caller's credential for one request

/** The caller's application credential for this request (set by authenticate, never persisted). */
export const credentialOf = (ctx) => ctx.session?.attributes?.[CREDENTIAL];

/**
 * Calls the application's own API with the caller's credential.
 * @param {object} ctx           AppPort capability context
 * @param {object} upstream      { baseUrl, headers(credential) => Record<string,string> }
 * @param {object} req           { method?, path, query?, body?, headers? }
 * @returns parsed JSON body (or null for 204)
 */
export async function callApplication(ctx, upstream, { method = "GET", path, query, body, headers = {} }) {
  const credential = credentialOf(ctx);
  if (!credential) throw errors.unauthorized("an application credential is required");
  const url = new URL(path, upstream.baseUrl);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetch(url, {
      method,
      redirect: "manual",
      signal: ctx.signal,
      headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...upstream.headers(credential), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch (e) {
    if (ctx.signal?.aborted) throw errors.cancelled("cancelled");
    // The application could not be reached: nothing is known about the request's effect.
    throw new AppPortError("INTERNAL_ERROR", "the application could not be reached", { retryable: true });
  }
  if (res.status >= 300 && res.status < 400) throw new AppPortError("INTERNAL_ERROR", `the application redirected (${res.status}); redirects are not followed`);
  if (res.status === 401) throw errors.unauthorized("the application rejected the credential");
  if (res.status === 403) throw errors.forbidden("the application denied access");
  if (res.status === 404) throw errors.notFound("not found in the application");
  if (res.status === 409) throw errors.conflict("the application reported a conflict");
  if (res.status === 400 || res.status === 422) throw errors.invalidInput("the application rejected the request");
  if (res.status === 429) throw errors.rateLimited("the application is rate limiting");
  if (!res.ok) throw new AppPortError("INTERNAL_ERROR", `the application failed (${res.status})`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Builds and serves a bridge.
 * @param {object} o
 * @param {{id:string,name:string,version:string,description?:string}} o.application
 * @param {Array} o.capabilities            AppPort capability definitions (defineCapability)
 * @param {string[]} o.scopes               AppPort scopes granted to any caller that presents a credential; the application
 *                                          still decides every individual access with that credential
 * @param {object} [o.resources]            integration resources (for `access` declarations)
 * @param {boolean} o.publish               opt-in public discovery
 * @param {Array} o.publishCapabilities     [{name, version, purpose?}]
 * @param {string} [o.host] [o.port]
 */
export async function startBridge(o) {
  const application = createApplication({
    application: o.application,
    capabilities: o.capabilities,
    ...(o.resources ? { resources: o.resources } : {}),
    authorizer: permissionAuthorizer()
  });
  const server = createServer({
    application,
    publication: o.publish ? { public: true, applicationDescription: true, capabilities: o.publishCapabilities } : undefined,
    authenticate: ({ headers }) => {
      const credential = headers?.authorization;
      if (!credential || typeof credential !== "string" || credential.length > 4096) return {};
      const principal = { id: `credential:${createHash("sha256").update(credential).digest("hex").slice(0, 16)}`, type: /** @type {const} */ ("user") };
      return {
        principal,
        session: {
          id: randomUUID(), principal, applicationId: o.application.id, createdAt: new Date().toISOString(),
          permissions: o.scopes, attributes: { [CREDENTIAL]: credential }
        }
      };
    }
  });
  const running = await serve({ server, host: o.host ?? "127.0.0.1", port: Number(o.port ?? 0), websocket: false });
  return running;
}

/** Reads bridge configuration from the environment. The bridge does not start unless an upstream is configured. */
export function bridgeConfigFromEnv(env = process.env) {
  const upstream = env.APPPORT_BRIDGE_UPSTREAM;
  if (!upstream) throw new Error("APPPORT_BRIDGE_UPSTREAM is not set: the AppPort bridge is disabled unless explicitly configured");
  return {
    upstream: new URL(upstream).toString(),
    host: env.APPPORT_BRIDGE_HOST || "127.0.0.1",
    port: Number(env.APPPORT_BRIDGE_PORT || 0),
    publish: env.APPPORT_BRIDGE_PUBLIC === "1"
  };
}

/** Starts a bridge from a capability module and prints one JSON ready line (for supervisors and tests). */
export async function runBridgeMain(build) {
  const config = bridgeConfigFromEnv();
  const running = await build(config);
  process.stdout.write(JSON.stringify({ ready: true, url: running.url, publish: config.publish }) + "\n");
  const stop = async () => { try { await running.close(); } finally { process.exit(0); } };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
