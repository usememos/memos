import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { getAccessToken, setAccessToken } from "./auth-state";
import { ActivityService } from "./types/proto/api/v1/activity_service_pb";
import { AttachmentService } from "./types/proto/api/v1/attachment_service_pb";
import { AuthService } from "./types/proto/api/v1/auth_service_pb";
import { IdentityProviderService } from "./types/proto/api/v1/idp_service_pb";
import { InstanceService } from "./types/proto/api/v1/instance_service_pb";
import { MemoService } from "./types/proto/api/v1/memo_service_pb";
import { ShortcutService } from "./types/proto/api/v1/shortcut_service_pb";
import { UserService } from "./types/proto/api/v1/user_service_pb";

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Authentication interceptor that:
 * 1. Attaches access token to outgoing requests
 * 2. Handles 401 Unauthenticated errors by refreshing the token
 * 3. Retries the original request with the new token
 * 4. Redirects to login if refresh fails
 */
const authInterceptor: Interceptor = (next) => async (req) => {
  // Add access token to request if available
  const token = getAccessToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await next(req);
  } catch (error) {
    // Only handle ConnectError with Unauthenticated code
    if (error instanceof ConnectError && error.code === Code.Unauthenticated && !req.header.get("X-Retry")) {
      // Prevent concurrent refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }

      try {
        await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        // Retry with new token
        const newToken = getAccessToken();
        if (newToken) {
          req.header.set("Authorization", `Bearer ${newToken}`);
          req.header.set("X-Retry", "true");
          return await next(req);
        }
      } catch (refreshError) {
        isRefreshing = false;
        refreshPromise = null;
        // Refresh failed - redirect to login (only if not already there)
        if (!window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth";
        }
        throw refreshError;
      }
    }
    throw error;
  }
};

/**
 * Custom fetch that includes credentials for cookie handling.
 * Required for HttpOnly refresh token cookie to be sent/received.
 */
const fetchWithCredentials: typeof globalThis.fetch = (input, init) => {
  return globalThis.fetch(input, {
    ...init,
    credentials: "include",
  });
};

/**
 * Separate transport for refresh token operations.
 * Uses no auth interceptor to avoid circular dependency when the main
 * interceptor triggers a refresh.
 */
const refreshTransport = createConnectTransport({
  baseUrl: window.location.origin,
  useBinaryFormat: true,
  fetch: fetchWithCredentials,
  interceptors: [], // No interceptors to avoid recursion
});

// Dedicated auth client for refresh operations only
const refreshAuthClient = createClient(AuthService, refreshTransport);

/**
 * Refreshes the access token using the HttpOnly refresh token cookie.
 * Called automatically by the auth interceptor when requests fail with 401.
 */
async function refreshAccessToken(): Promise<void> {
  const response = await refreshAuthClient.refreshToken({});
  setAccessToken(response.accessToken, response.expiresAt ? timestampDate(response.expiresAt) : undefined);
}

/**
 * Main transport for all API requests.
 */
const transport = createConnectTransport({
  baseUrl: window.location.origin,
  useBinaryFormat: true,
  fetch: fetchWithCredentials,
  interceptors: [authInterceptor],
});

// Core service clients
export const instanceServiceClient = createClient(InstanceService, transport);
export const authServiceClient = createClient(AuthService, transport);
export const userServiceClient = createClient(UserService, transport);

// Content service clients
export const memoServiceClient = createClient(MemoService, transport);
export const attachmentServiceClient = createClient(AttachmentService, transport);
export const shortcutServiceClient = createClient(ShortcutService, transport);
export const activityServiceClient = createClient(ActivityService, transport);

// Configuration service clients
export const identityProviderServiceClient = createClient(IdentityProviderService, transport);
