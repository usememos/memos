import { Code, ConnectError } from "@connectrpc/connect";
import type { Env } from "../env";
import type { UserRow } from "../store/users";

// Shared per-request context handed to every service implementation.
export interface ServiceContext {
  env: Env;
  /** Authenticated user, or undefined for anonymous requests on public paths. */
  user?: UserRow;
  /** Defers work past the response (webhooks, notifications). No-op in tests without an ExecutionContext. */
  waitUntil: (promise: Promise<unknown>) => void;
}

export function requireUser(ctx: ServiceContext): UserRow {
  if (!ctx.user) {
    throw new ConnectError("user not authenticated", Code.Unauthenticated);
  }
  return ctx.user;
}

export function requireAdmin(ctx: ServiceContext): UserRow {
  const user = requireUser(ctx);
  if (user.role !== "ADMIN") {
    throw new ConnectError("permission denied", Code.PermissionDenied);
  }
  return user;
}
