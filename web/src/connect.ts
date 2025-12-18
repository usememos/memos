import { createClient, Interceptor } from "@connectrpc/connect";
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

// Auth interceptor that attaches access token and handles 401 errors by refreshing
const authInterceptor: Interceptor = (next) => async (req) => {
  // Add access token to request if available
  const token = getAccessToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await next(req);
  } catch (error: any) {
    // Handle unauthenticated error - try to refresh token
    if (error.code === "unauthenticated" && !req.header.get("X-Retry")) {
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
        // Refresh failed - redirect to login
        window.location.href = "/auth";
        throw refreshError;
      }
    }
    throw error;
  }
};

async function refreshAccessToken(): Promise<void> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include", // Include HttpOnly cookies with refresh token
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  setAccessToken(data.accessToken, new Date(data.expiresAt));
}

const transport = createConnectTransport({
  baseUrl: window.location.origin,
  // Use binary protobuf format for better performance (smaller payloads, faster serialization)
  useBinaryFormat: true,
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
