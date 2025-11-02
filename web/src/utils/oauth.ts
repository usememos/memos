/**
 * OAuth state management utilities
 * Implements secure state parameter handling following Auth0 best practices
 * @see https://auth0.com/docs/secure/attack-protection/state-parameters
 */

const STATE_STORAGE_KEY = "oauth_state";
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface OAuthState {
  state: string;
  identityProviderId: number;
  timestamp: number;
  returnUrl?: string;
}

/**
 * Generate a cryptographically secure random state value
 * Uses Web Crypto API for strong randomness
 */
function generateSecureState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Store OAuth state in sessionStorage with metadata
 * State is stored temporarily and will be validated on callback
 */
export function storeOAuthState(identityProviderId: number, returnUrl?: string): string {
  const state = generateSecureState();
  const stateData: OAuthState = {
    state,
    identityProviderId,
    timestamp: Date.now(),
    returnUrl,
  };

  try {
    sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateData));
  } catch (error) {
    console.error("Failed to store OAuth state:", error);
    throw new Error("Failed to initialize OAuth flow");
  }

  return state;
}

/**
 * Validate and retrieve OAuth state from storage
 * Implements CSRF protection by verifying state matches
 * Cleans up expired or used states
 */
export function validateOAuthState(stateParam: string): { identityProviderId: number; returnUrl?: string } | null {
  try {
    const storedData = sessionStorage.getItem(STATE_STORAGE_KEY);
    if (!storedData) {
      console.error("No OAuth state found in storage");
      return null;
    }

    const stateData: OAuthState = JSON.parse(storedData);

    // Check if state has expired
    if (Date.now() - stateData.timestamp > STATE_EXPIRY_MS) {
      console.error("OAuth state has expired");
      sessionStorage.removeItem(STATE_STORAGE_KEY);
      return null;
    }

    // Validate state matches (CSRF protection)
    if (stateData.state !== stateParam) {
      console.error("OAuth state mismatch - possible CSRF attack");
      sessionStorage.removeItem(STATE_STORAGE_KEY);
      return null;
    }

    // State is valid, clean up and return data
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return {
      identityProviderId: stateData.identityProviderId,
      returnUrl: stateData.returnUrl,
    };
  } catch (error) {
    console.error("Failed to validate OAuth state:", error);
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return null;
  }
}

/**
 * Clean up expired OAuth states
 * Should be called on app initialization
 */
export function cleanupExpiredOAuthState(): void {
  try {
    const storedData = sessionStorage.getItem(STATE_STORAGE_KEY);
    if (!storedData) {
      return;
    }

    const stateData: OAuthState = JSON.parse(storedData);
    if (Date.now() - stateData.timestamp > STATE_EXPIRY_MS) {
      sessionStorage.removeItem(STATE_STORAGE_KEY);
    }
  } catch {
    // If parsing fails, remove the corrupted data
    sessionStorage.removeItem(STATE_STORAGE_KEY);
  }
}
