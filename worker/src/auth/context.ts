import type { Env } from "../env";
import { verifyAccessJwt } from "./access";
import { createUser, getUser, updateUser, type Role, type UserRow } from "../store/users";

// Per-request context resolved from the Cloudflare Access JWT.
// user is undefined for anonymous requests on Access-bypassed public paths.
export interface RequestContext {
  user?: UserRow;
}

export async function resolveRequestContext(request: Request, env: Env): Promise<RequestContext> {
  const email = await resolveEmail(request, env);
  if (!email) {
    return {};
  }
  const user = await provisionUser(env, email);
  return { user };
}

async function resolveEmail(request: Request, env: Env): Promise<string | undefined> {
  // On Access-protected paths the JWT arrives as a header; on bypassed public
  // paths Access doesn't process the request, but the browser still sends the
  // domain-scoped CF_Authorization cookie carrying the same JWT.
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion") ?? readAuthCookie(request);
  if (assertion) {
    try {
      const claims = await verifyAccessJwt(assertion, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
      return claims.email;
    } catch (error) {
      // A stale/invalid cookie on a public path degrades to anonymous; a bad
      // header (which only Access itself sets) is a hard failure.
      if (request.headers.has("Cf-Access-Jwt-Assertion")) {
        throw error;
      }
      return undefined;
    }
  }
  // Local development fallback; DEV_USER_EMAIL must stay empty in production.
  if (env.DEV_USER_EMAIL) {
    return env.DEV_USER_EMAIL.toLowerCase();
  }
  return undefined;
}

function readAuthCookie(request: Request): string | undefined {
  const cookies = request.headers.get("Cookie");
  if (!cookies) {
    return undefined;
  }
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "CF_Authorization") {
      return rest.join("=");
    }
  }
  return undefined;
}

// Looks up the user by verified email, creating it on first sign-in.
async function provisionUser(env: Env, email: string): Promise<UserRow> {
  const existing = await getUser(env.DB, { email });
  if (existing) {
    const expectedRole = roleForEmail(env, email);
    // Promote/demote when ADMIN_EMAILS changes; the env var is authoritative.
    if (existing.role !== expectedRole) {
      return updateUser(env.DB, { id: existing.id, role: expectedRole });
    }
    return existing;
  }
  const username = await pickUsername(env.DB, email);
  return createUser(env.DB, {
    username,
    role: roleForEmail(env, email),
    email,
    nickname: email.split("@")[0] ?? email,
  });
}

function roleForEmail(env: Env, email: string): Role {
  const admins = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== "");
  return admins.includes(email) ? "ADMIN" : "USER";
}

// Derives a unique username from the email local part (usernames appear in
// resource names like users/{username} and RSS routes).
async function pickUsername(db: D1Database, email: string): Promise<string> {
  const base =
    (email.split("@")[0] ?? "user")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "") || "user";
  let candidate = base;
  for (let i = 1; ; i++) {
    const taken = await getUser(db, { username: candidate });
    if (!taken) {
      return candidate;
    }
    candidate = `${base}-${i}`;
  }
}
