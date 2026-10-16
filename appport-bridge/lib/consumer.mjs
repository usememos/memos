// Independent AppPort consumer helpers: published @appport/sdk only, secure defaults, outcomes kept apart.

import { AppPort, AppPortError } from "@appport/sdk";

/** Public discovery; returns the result unchanged. Never treat it as trust or authorization. */
export const discover = (origin, opts = {}) => AppPort.discoverApplication({ origin, timeoutMs: 10_000, ...opts });

/** Connects with the caller's own application credential (sent as `authorization`, exactly as the application expects it). */
export const connect = (origin, credential, opts = {}) =>
  AppPort.discover({ origin, redirects: "refuse", ...(credential ? { headers: { authorization: credential } } : {}), ...opts });

/**
 * Invokes once and classifies the outcome. Never retries.
 *   response          the bridge answered (an answer, not evidence)
 *   denied            UNAUTHORIZED / FORBIDDEN
 *   application-error any other error code (NOT_FOUND, INVALID_INPUT, CONFLICT, ...)
 *   no-response       the answer was lost: the operation may or may not have run
 */
export async function invoke(client, name, input, version = 1) {
  try { return { kind: "response", output: await client.call(name, input, { version }) }; }
  catch (e) {
    const code = e?.code ?? "ERROR";
    if (e instanceof AppPortError && e.retryable && e.cause !== undefined) return { kind: "no-response", code };
    return { kind: code === "FORBIDDEN" || code === "UNAUTHORIZED" ? "denied" : "application-error", code };
  }
}

/**
 * The only way a test may call something a success: the response AND an independent observation agree.
 * @returns "confirmed" | "contradicted" | "unverified" | "denied" | "failed" | "indeterminate"
 */
export function verdict(outcome, observationAgrees) {
  if (outcome.kind === "no-response") return "indeterminate";
  if (outcome.kind === "denied") return "denied";
  if (outcome.kind === "application-error") return "failed";
  if (observationAgrees === undefined) return "unverified";
  return observationAgrees ? "confirmed" : "contradicted";
}

/** A fetch that delivers the request, then loses the response for calls matching `pred` (simulates a dropped connection). */
export const losingFetch = (pred) => async (url, init) => {
  const res = await fetch(url, init);
  if (pred(String(url), init)) { await res.arrayBuffer(); throw new TypeError("fetch failed: socket hang up"); }
  return res;
};
export const isCallTo = (capability) => (url, init) => url.endsWith("/appport") && init?.method === "POST" && String(init.body).includes(`"${capability}"`);
