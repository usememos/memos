import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Module-scope cache: jose's remote JWK set caches keys per isolate and
// refetches on unknown kid, which matches Access key rotation behavior.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksTeamDomain: string | undefined;

export interface AccessClaims {
  email: string;
  /** Subject is empty for service tokens; common name lives in the identity claim. */
  sub: string;
}

// Accepts the team name in any of the common forms and returns the bare team
// slug: "yugai", "yugai.cloudflareaccess.com", or "https://yugai.cloudflareaccess.com".
export function normalizeTeamDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.cloudflareaccess\.com$/i, "");
}

// Verifies a Cloudflare Access JWT (Cf-Access-Jwt-Assertion) and returns the
// authenticated email. Throws on any validation failure.
export async function verifyAccessJwt(assertion: string, teamDomain: string, aud: string): Promise<AccessClaims> {
  if (!teamDomain || !aud) {
    throw new Error("ACCESS_TEAM_DOMAIN and ACCESS_AUD must be configured");
  }
  const team = normalizeTeamDomain(teamDomain);
  const issuer = `https://${team}.cloudflareaccess.com`;
  if (!jwks || jwksTeamDomain !== team) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksTeamDomain = team;
  }
  const { payload } = await jwtVerify(assertion, jwks, { issuer, audience: aud });
  return { email: extractEmail(payload), sub: payload.sub ?? "" };
}

function extractEmail(payload: JWTPayload): string {
  if (typeof payload.email === "string" && payload.email !== "") {
    return payload.email.toLowerCase();
  }
  // Service tokens carry no email; identify them via the common_name claim so
  // they can be mapped to a dedicated user (e.g. an ADMIN_EMAILS entry).
  const commonName = (payload as Record<string, unknown>).common_name;
  if (typeof commonName === "string" && commonName !== "") {
    return commonName.toLowerCase();
  }
  throw new Error("Access JWT has neither email nor common_name claim");
}
