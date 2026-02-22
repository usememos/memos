// Access token storage using localStorage for persistence across tabs and sessions.
// Tokens are cleared on logout or expiry.
let accessToken: string | null = null;
let tokenExpiresAt: Date | null = null;

const TOKEN_KEY = "memos_access_token";
const EXPIRES_KEY = "memos_token_expires_at";

export const getAccessToken = (): string | null => {
  if (!accessToken) {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedExpires = localStorage.getItem(EXPIRES_KEY);

      if (storedToken && storedExpires) {
        const expiresAt = new Date(storedExpires);
        if (expiresAt > new Date()) {
          accessToken = storedToken;
          tokenExpiresAt = expiresAt;
        } else {
          // Token expired, clean up
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(EXPIRES_KEY);
        }
      }
    } catch (e) {
      // localStorage might not be available (e.g., in some privacy modes)
      console.warn("Failed to access localStorage:", e);
    }
  }
  return accessToken;
};

export const setAccessToken = (token: string | null, expiresAt?: Date): void => {
  accessToken = token;
  tokenExpiresAt = expiresAt || null;

  try {
    if (token && expiresAt) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EXPIRES_KEY, expiresAt.toISOString());
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    }
  } catch (e) {
    // localStorage might not be available (e.g., in some privacy modes)
    console.warn("Failed to write to localStorage:", e);
  }
};

export const isTokenExpired = (bufferMs: number = 30000): boolean => {
  if (!tokenExpiresAt) return true;
  // Consider expired with a safety buffer before actual expiry
  // Default: 30 seconds for regular requests
  // Can use longer buffer (e.g., 2 minutes) for proactive refresh
  return new Date() >= new Date(tokenExpiresAt.getTime() - bufferMs);
};

// Returns true if a token exists in localStorage, even if it is expired.
// Used to decide whether to attempt GetCurrentUser on app init — if no token
// was ever stored, the user is definitively not logged in and there is nothing
// to refresh, so we can skip the network round-trip entirely.
export const hasStoredToken = (): boolean => {
  if (accessToken) return true;
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
};

export const clearAccessToken = (): void => {
  accessToken = null;
  tokenExpiresAt = null;

  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch (e) {
    console.warn("Failed to clear localStorage:", e);
  }
};
