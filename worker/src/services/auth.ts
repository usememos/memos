import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { AuthService, GetCurrentUserResponseSchema } from "../gen/api/v1/auth_service_pb";
import type { ServiceContext } from "./context";
import { convertUser } from "./convert";

// SignIn/SignOut/RefreshToken are gone: authentication is handled entirely by
// Cloudflare Access in front of the Worker. Only GetCurrentUser remains.
export function registerAuthService(router: ConnectRouter, ctx: ServiceContext): void {
  router.service(AuthService, {
    getCurrentUser() {
      if (!ctx.user) {
        throw new ConnectError("user not authenticated", Code.Unauthenticated);
      }
      return create(GetCurrentUserResponseSchema, {
        user: convertUser(ctx.user, ctx.user),
      });
    },
    signIn() {
      throw new ConnectError("sign-in is handled by Cloudflare Access", Code.Unimplemented);
    },
    signOut() {
      throw new ConnectError("sign-out is handled by Cloudflare Access", Code.Unimplemented);
    },
    refreshToken() {
      throw new ConnectError("tokens are handled by Cloudflare Access", Code.Unimplemented);
    },
  });
}
