import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { getAccessToken, setAccessToken } from "./auth-state";
import { ROUTES } from "./router/routes";
import { instanceStore } from "./store";
import { ActivityService } from "./types/proto/api/v1/activity_service_pb";
import { AttachmentService } from "./types/proto/api/v1/attachment_service_pb";
import { AuthService } from "./types/proto/api/v1/auth_service_pb";
import { IdentityProviderService } from "./types/proto/api/v1/idp_service_pb";
import { InstanceService } from "./types/proto/api/v1/instance_service_pb";
import { MemoService } from "./types/proto/api/v1/memo_service_pb";
import { ShortcutService } from "./types/proto/api/v1/shortcut_service_pb";
import { UserService } from "./types/proto/api/v1/user_service_pb";

// ============================================================================
// Constants
// ============================================================================

const RETRY_HEADER = "X-Retry";
const RETRY_HEADER_VALUE = "true";

const ROUTE_CONFIG = {
  // Routes accessible without authentication (uses prefix matching)
  public: [
    ROUTES.AUTH, // Authentication pages
    ROUTES.EXPLORE, // Explore page
    "/u/", // User profile pages (dynamic)
    "/memos/", // Individual memo detail pages (dynamic)
  ],

  // Routes that require authentication (uses exact matching)
  private: [ROUTES.ROOT, ROUTES.ATTACHMENTS, ROUTES.INBOX, ROUTES.ARCHIVED, ROUTES.SETTING],
} as const;

// ============================================================================
// Token Refresh State Management
// ============================================================================

class TokenRefreshManager {
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  async refresh(refreshFn: () => Promise<void>): Promise<void> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = refreshFn().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }
}

const tokenRefreshManager = new TokenRefreshManager();

// ============================================================================
// Route Access Control
// ============================================================================

function isPublicRoute(path: string): boolean {
  return ROUTE_CONFIG.public.some((route) => path.startsWith(route));
}

function isPrivateRoute(path: string): boolean {
  return (ROUTE_CONFIG.private as readonly string[]).includes(path);
}

function getAuthFailureRedirect(currentPath: string): string | null {
  if (isPublicRoute(currentPath)) {
    return null;
  }

  if (instanceStore.state.memoRelatedSetting.disallowPublicVisibility) {
    return ROUTES.AUTH;
  }

  if (isPrivateRoute(currentPath)) {
    return ROUTES.EXPLORE;
  }

  return null;
}

function performRedirect(redirectUrl: string | null): void {
  if (redirectUrl) {
    // Use replace() instead of href to prevent back button from showing cached sensitive data
    // This removes the current page from browser history after authentication failure
    window.location.replace(redirectUrl);
  }
}

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

async function refreshAccessToken(): Promise<void> {
  const response = await refreshAuthClient.refreshToken({});

  if (!response.accessToken) {
    throw new ConnectError("Refresh token response missing access token", Code.Internal);
  }

  const expiresAt = response.expiresAt ? timestampDate(response.expiresAt) : undefined;
  setAccessToken(response.accessToken, expiresAt);
}

// ============================================================================
// Authentication Interceptor
// ============================================================================

const authInterceptor: Interceptor = (next) => async (req) => {
  const token = getAccessToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await next(req);
  } catch (error) {
    if (!(error instanceof ConnectError)) {
      throw error;
    }

    if (error.code !== Code.Unauthenticated) {
      throw error;
    }

    if (req.header.get(RETRY_HEADER) === RETRY_HEADER_VALUE) {
      throw error;
    }

    try {
      await tokenRefreshManager.refresh(refreshAccessToken);

      const newToken = getAccessToken();
      if (!newToken) {
        throw new ConnectError("Token refresh succeeded but no token available", Code.Internal);
      }

      req.header.set("Authorization", `Bearer ${newToken}`);
      req.header.set(RETRY_HEADER, RETRY_HEADER_VALUE);
      return await next(req);
    } catch (refreshError) {
      const redirectUrl = getAuthFailureRedirect(window.location.pathname);
      performRedirect(redirectUrl);
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
