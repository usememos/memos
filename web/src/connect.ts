import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { getAccessToken, isTokenExpired, REQUEST_TOKEN_EXPIRY_BUFFER_MS, setAccessToken } from "./auth-state";
import { ActivityService } from "./types/proto/api/v1/activity_service_pb";
import { AttachmentService } from "./types/proto/api/v1/attachment_service_pb";
import { AuthService } from "./types/proto/api/v1/auth_service_pb";
import { IdentityProviderService } from "./types/proto/api/v1/idp_service_pb";
import { InstanceService } from "./types/proto/api/v1/instance_service_pb";
import { MemoService } from "./types/proto/api/v1/memo_service_pb";
import { ShortcutService } from "./types/proto/api/v1/shortcut_service_pb";
import { UserService } from "./types/proto/api/v1/user_service_pb";
import { redirectOnAuthFailure } from "./utils/auth-redirect";

interface RequestWithHeader {
  header: Headers;
}

// ============================================================================
// Constants
// ============================================================================

const RETRY_HEADER = "X-Retry";
const RETRY_HEADER_VALUE = "true";

// ============================================================================
// Token Refresh State Management
// ============================================================================

const createTokenRefreshManager = () => {
  let isRefreshing = false;
  let refreshPromise: Promise<void> | null = null;

  return {
    async refresh(refreshFn: () => Promise<void>): Promise<void> {
      if (isRefreshing && refreshPromise) {
        return refreshPromise;
      }

      isRefreshing = true;
      refreshPromise = refreshFn().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });

      return refreshPromise;
    },
  };
};

const tokenRefreshManager = createTokenRefreshManager();

// ============================================================================
// Token Refresh
// ============================================================================

const fetchWithCredentials: typeof globalThis.fetch = (input, init) => {
  return globalThis.fetch(input, {
    ...init,
    credentials: "include",
  });
};

// Separate transport without auth interceptor to prevent recursion
const refreshTransport = createConnectTransport({
  baseUrl: window.location.origin,
  useBinaryFormat: true,
  fetch: fetchWithCredentials,
  interceptors: [],
});

const refreshAuthClient = createClient(AuthService, refreshTransport);

async function doRefreshAccessToken(): Promise<void> {
  const response = await refreshAuthClient.refreshToken({});

  if (!response.accessToken) {
    throw new ConnectError("Refresh token response missing access token", Code.Internal);
  }

  const expiresAt = response.expiresAt ? timestampDate(response.expiresAt) : undefined;
  setAccessToken(response.accessToken, expiresAt);
}

// All callers go through the manager to deduplicate concurrent refresh requests.
// This prevents race conditions between useTokenRefreshOnFocus (proactive refresh
// on tab focus) and the auth interceptor (reactive refresh on 401), which could
// otherwise send duplicate requests that conflict with server-side token rotation.
export async function refreshAccessToken(): Promise<void> {
  return tokenRefreshManager.refresh(doRefreshAccessToken);
}

// ============================================================================
// Authentication Interceptor Helpers
// ============================================================================

function setAuthorizationHeader(req: RequestWithHeader, token: string | null) {
  if (!token) return;
  req.header.set("Authorization", `Bearer ${token}`);
}

function shouldHandleUnauthenticatedRetry(error: unknown, isRetryAttempt: boolean): boolean {
  if (!(error instanceof ConnectError)) {
    return false;
  }
  if (error.code !== Code.Unauthenticated) {
    return false;
  }
  if (isRetryAttempt) {
    return false;
  }
  return true;
}

async function refreshAndGetAccessToken(): Promise<string> {
  await refreshAccessToken();
  const token = getAccessToken();
  if (!token) {
    throw new ConnectError("Token refresh succeeded but no token available", Code.Internal);
  }
  return token;
}

async function getRequestToken(): Promise<string | null> {
  let token = getAccessToken();
  if (!token) {
    return null;
  }

  // Preflight refresh: avoid sending requests with expired access tokens.
  // This is especially important for public endpoints (e.g. ListMemos), where
  // an expired token could otherwise be treated as anonymous and return
  // guest-scoped data before the reactive 401 refresh path runs.
  if (isTokenExpired(REQUEST_TOKEN_EXPIRY_BUFFER_MS)) {
    try {
      token = await refreshAndGetAccessToken();
    } catch {
      // Keep existing reactive 401 flow as fallback.
      // Protected methods still trigger refresh/redirect in the catch block below.
    }
  }

  return token;
}

// ============================================================================
// Authentication Interceptor
// ============================================================================

const authInterceptor: Interceptor = (next) => async (req) => {
  const isRetryAttempt = req.header.get(RETRY_HEADER) === RETRY_HEADER_VALUE;
  const token = await getRequestToken();
  setAuthorizationHeader(req, token);

  try {
    return await next(req);
  } catch (error) {
    if (!shouldHandleUnauthenticatedRetry(error, isRetryAttempt)) {
      throw error;
    }

    try {
      const newToken = await refreshAndGetAccessToken();
      setAuthorizationHeader(req, newToken);
      req.header.set(RETRY_HEADER, RETRY_HEADER_VALUE);
      return await next(req);
    } catch (refreshError) {
      redirectOnAuthFailure();
      throw refreshError;
    }
  }
};

// ============================================================================
// Transport & Service Clients
// ============================================================================

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
