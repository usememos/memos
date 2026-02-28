const STATE_STORAGE_KEY = "oauth_state";
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface OAuthState {
  state: string;
  identityProviderId: number;
  timestamp: number;
  returnUrl?: string;
  codeVerifier?: string; // PKCE code_verifier
}

// Generate a cryptographically secure random state value
function generateSecureState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Generate a cryptographically secure random code_verifier for PKCE (RFC 7636)
// Returns a URL-safe base64 string (43-128 characters)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32); // 256 bits = 32 bytes
  crypto.getRandomValues(array);
  // Convert to base64url (URL-safe base64 without padding)
  return base64UrlEncode(array);
}

// Generate code_challenge from code_verifier using SHA-256
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

// Base64URL encoding (RFC 4648 base64url without padding)
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Store OAuth state and PKCE parameters in sessionStorage
// Returns state and optional codeChallenge for use in authorization URL
// PKCE is optional - if crypto APIs are unavailable (HTTP context), falls back to standard OAuth
export async function storeOAuthState(identityProviderId: number, returnUrl?: string): Promise<{ state: string; codeChallenge?: string }> {
  const state = generateSecureState();

  // Try to generate PKCE parameters if crypto.subtle is available (HTTPS/localhost)
  // Falls back to standard OAuth flow if unavailable (HTTP context)
  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;

  try {
    // Check if crypto.subtle is available (requires secure context: HTTPS or localhost)
    if (typeof crypto !== "undefined" && crypto.subtle) {
      codeVerifier = generateCodeVerifier();
      codeChallenge = await generateCodeChallenge(codeVerifier);
    } else {
      console.warn(
        "PKCE not available: crypto.subtle requires HTTPS. Falling back to standard OAuth flow without PKCE. " +
          "For enhanced security, please access Memos over HTTPS.",
      );
    }
  } catch (error) {
    // If PKCE generation fails for any reason, fall back to standard OAuth
    console.warn("Failed to generate PKCE parameters, falling back to standard OAuth:", error);
    codeVerifier = undefined;
    codeChallenge = undefined;
  }

  const stateData: OAuthState = {
    state,
    identityProviderId,
    timestamp: Date.now(),
    returnUrl,
    codeVerifier, // Store for later retrieval in callback (undefined if PKCE not available)
  };

  try {
    sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateData));
  } catch (error) {
    console.error("Failed to store OAuth state:", error);
    throw new Error("Failed to initialize OAuth flow");
  }

  return { state, codeChallenge };
}

// Validate and retrieve OAuth state from storage (CSRF protection)
// Returns identityProviderId, returnUrl, and codeVerifier for PKCE
export function validateOAuthState(stateParam: string): { identityProviderId: number; returnUrl?: string; codeVerifier?: string } | null {
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
      codeVerifier: stateData.codeVerifier, // Return PKCE code_verifier
    };
  } catch (error) {
    console.error("Failed to validate OAuth state:", error);
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return null;
  }
}

// Clean up expired OAuth states (call on app init)
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
