// Access token storage using localStorage for persistence across tabs and sessions.
// Tokens are cleared on logout or expiry.
let accessToken: string | null = null;
let tokenExpiresAt: Date | null = null;

const TOKEN_KEY = "memos_access_token";
const EXPIRES_KEY = "memos_token_expires_at";

// BroadcastChannel lets tabs share freshly-refreshed tokens so that only one
// tab needs to hit the refresh endpoint. When another tab successfully refreshes
// we adopt the new token immediately, avoiding a redundant (and potentially
// conflicting) refresh request of our own.
const TOKEN_CHANNEL_NAME = "memos_token_sync";

interface TokenBroadcastMessage {
  token: string;
  expiresAt: string; // ISO string
}

let tokenChannel: BroadcastChannel | null = null;

function getTokenChannel(): BroadcastChannel | null {
  if (tokenChannel) return tokenChannel;
  try {
    tokenChannel = new BroadcastChannel(TOKEN_CHANNEL_NAME);
    tokenChannel.onmessage = (event: MessageEvent<TokenBroadcastMessage>) => {
      const { token, expiresAt } = event.data ?? {};
      if (token && expiresAt) {
        // Another tab refreshed — adopt the token in-memory so we don't
        // fire our own refresh request.
        accessToken = token;
        tokenExpiresAt = new Date(expiresAt);
      }
    };
  } catch {
    // BroadcastChannel not available (e.g. some privacy modes)
    tokenChannel = null;
  }
  return tokenChannel;
}

// Initialize the channel at module load so the listener is registered
// before any token refresh can occur in any tab.
getTokenChannel();

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
        }
        // Do NOT remove expired tokens here. Callers such as InstanceContext.initialize()
        // run concurrently with AuthContext.initialize() via Promise.all. If we eagerly
        // delete the expired token from localStorage, hasStoredToken() (called synchronously
        // inside AuthContext.initialize()) finds nothing and skips the refresh attempt,
        // logging the user out even when the refresh-token cookie is still valid.
        // clearAccessToken() handles proper cleanup after a confirmed auth failure or logout.
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
      // Broadcast to other tabs so they adopt the new token without refreshing.
      const msg: TokenBroadcastMessage = { token, expiresAt: expiresAt.toISOString() };
      getTokenChannel()?.postMessage(msg);
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
