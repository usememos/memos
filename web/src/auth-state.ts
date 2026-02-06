// Access token storage using sessionStorage for persistence across page refreshes
// sessionStorage is cleared when the tab/window is closed, providing reasonable security
// while avoiding unnecessary token refreshes on page reload
let accessToken: string | null = null;
let tokenExpiresAt: Date | null = null;

const SESSION_TOKEN_KEY = "memos_access_token";
const SESSION_EXPIRES_KEY = "memos_token_expires_at";

export const getAccessToken = (): string | null => {
  // If not in memory, try to restore from sessionStorage
  if (!accessToken) {
    try {
      const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
      const storedExpires = sessionStorage.getItem(SESSION_EXPIRES_KEY);

      if (storedToken && storedExpires) {
        const expiresAt = new Date(storedExpires);
        // Only restore if token hasn't expired
        if (expiresAt > new Date()) {
          accessToken = storedToken;
          tokenExpiresAt = expiresAt;
        } else {
          // Token expired, clean up sessionStorage
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          sessionStorage.removeItem(SESSION_EXPIRES_KEY);
        }
      }
    } catch (e) {
      // sessionStorage might not be available (e.g., in some privacy modes)
      console.warn("Failed to access sessionStorage:", e);
    }
  }
  return accessToken;
};

export const setAccessToken = (token: string | null, expiresAt?: Date): void => {
  accessToken = token;
  tokenExpiresAt = expiresAt || null;

  try {
    if (token && expiresAt) {
      // Store in sessionStorage for persistence across page refreshes
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_EXPIRES_KEY, expiresAt.toISOString());
    } else {
      // Clear sessionStorage if token is being cleared
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    }
  } catch (e) {
    // sessionStorage might not be available (e.g., in some privacy modes)
    console.warn("Failed to write to sessionStorage:", e);
  }
};

export const isTokenExpired = (bufferMs: number = 30000): boolean => {
  if (!tokenExpiresAt) return true;
  // Consider expired with a safety buffer before actual expiry
  // Default: 30 seconds for regular requests
  // Can use longer buffer (e.g., 2 minutes) for proactive refresh
  return new Date() >= new Date(tokenExpiresAt.getTime() - bufferMs);
};

export const clearAccessToken = (): void => {
  accessToken = null;
  tokenExpiresAt = null;

  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
  } catch (e) {
    console.warn("Failed to clear sessionStorage:", e);
  }
};
