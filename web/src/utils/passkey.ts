import { getAccessToken, hasStoredToken, isTokenExpired, REQUEST_TOKEN_EXPIRY_BUFFER_MS } from "@/auth-state";
import { refreshAccessToken } from "@/connect";
import type { Translations } from "@/utils/i18n";

type PasskeyCredentialDescriptorJSON = {
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
};

type BeginPasskeyRegistrationResponse = {
  state: string;
  publicKey: {
    challenge: string;
    rp: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      name: string;
      displayName: string;
    };
    pubKeyCredParams: Array<{
      type: "public-key";
      alg: number;
    }>;
    timeout: number;
    attestation: AttestationConveyancePreference;
    excludeCredentials?: PasskeyCredentialDescriptorJSON[];
    authenticatorSelection?: AuthenticatorSelectionCriteria;
  };
};

type BeginPasskeyAuthenticationResponse = {
  state: string;
  publicKey: {
    challenge: string;
    rpId: string;
    timeout: number;
    userVerification?: UserVerificationRequirement;
    allowCredentials?: PasskeyCredentialDescriptorJSON[];
  };
};

type FinishPasskeyAuthenticationResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
};

export type Passkey = {
  id: string;
  label: string;
  transports?: string[];
  addedTs: number;
  lastUsedTs?: number;
};

type ListPasskeysResponse = {
  passkeys: Passkey[];
};

type NativeRequestVisibility = "public" | "protected";
export type PasskeyAction = "create" | "sign-in";

function supportsPasskeys() {
  return typeof window !== "undefined" && typeof PublicKeyCredential !== "undefined" && !!navigator.credentials;
}

export function getPasskeyErrorKey(error: unknown, action: PasskeyAction): Translations | undefined {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "AbortError":
      case "NotAllowedError":
        return action === "create" ? "auth.passkey-create-cancelled" : "auth.passkey-sign-in-cancelled";
      case "InvalidStateError":
        return action === "create" ? "auth.passkey-already-exists" : "auth.passkey-sign-in-unavailable";
      case "NotSupportedError":
        return "auth.passkey-unsupported";
      case "SecurityError":
        return "auth.passkey-security-error";
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : typeof error === "string" ? error.toLowerCase() : "";
  if (message.includes("timed out or was not allowed") || message.includes("cancelled")) {
    return action === "create" ? "auth.passkey-create-cancelled" : "auth.passkey-sign-in-cancelled";
  }
  if (message.includes("passkey already exists")) {
    return "auth.passkey-already-exists";
  }
  if (message.includes("sign in is not available")) {
    return "auth.passkey-sign-in-unavailable";
  }
  if (message.includes("security")) {
    return "auth.passkey-security-error";
  }

  return undefined;
}

function bufferToBase64url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getProtectedHeaders(): Promise<HeadersInit> {
  let token = getAccessToken();

  if ((!token || isTokenExpired(REQUEST_TOKEN_EXPIRY_BUFFER_MS)) && hasStoredToken()) {
    await refreshAccessToken();
    token = getAccessToken();
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function nativePasskeyRequest<T>(path: string, init: RequestInit, visibility: NativeRequestVisibility): Promise<T> {
  const headers = visibility === "protected" ? await getProtectedHeaders() : { "Content-Type": "application/json" };
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parsing failures and keep fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function toCreationOptions(publicKey: BeginPasskeyRegistrationResponse["publicKey"]): PublicKeyCredentialCreationOptions {
  return {
    ...publicKey,
    challenge: base64urlToArrayBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64urlToArrayBuffer(publicKey.user.id),
    },
    excludeCredentials: publicKey.excludeCredentials?.map((descriptor) => ({
      ...descriptor,
      id: base64urlToArrayBuffer(descriptor.id),
    })),
  };
}

function toRequestOptions(publicKey: BeginPasskeyAuthenticationResponse["publicKey"]): PublicKeyCredentialRequestOptions {
  return {
    ...publicKey,
    challenge: base64urlToArrayBuffer(publicKey.challenge),
    allowCredentials: publicKey.allowCredentials?.map((descriptor) => ({
      ...descriptor,
      id: base64urlToArrayBuffer(descriptor.id),
    })),
  };
}

export async function createPasskey(): Promise<void> {
  if (!supportsPasskeys()) {
    throw new Error("This browser does not support passkeys");
  }

  const { state, publicKey } = await nativePasskeyRequest<BeginPasskeyRegistrationResponse>(
    "/api/v1/auth/passkeys/registration/begin",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    "protected",
  );

  const credential = await navigator.credentials.create({
    publicKey: toCreationOptions(publicKey),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey registration was cancelled");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  await nativePasskeyRequest<void>(
    "/api/v1/auth/passkeys/registration/finish",
    {
      method: "POST",
      body: JSON.stringify({
        state,
        credential: {
          id: bufferToBase64url(credential.rawId),
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            attestationObject: bufferToBase64url(response.attestationObject),
            transports: typeof response.getTransports === "function" ? response.getTransports() : [],
          },
        },
      }),
    },
    "protected",
  );
}

export async function listPasskeys(): Promise<Passkey[]> {
  const { passkeys } = await nativePasskeyRequest<ListPasskeysResponse>(
    "/api/v1/auth/passkeys",
    {
      method: "GET",
    },
    "protected",
  );

  return [...passkeys].sort((a, b) => b.addedTs - a.addedTs);
}

export async function deletePasskey(passkeyID: string): Promise<void> {
  await nativePasskeyRequest<void>(
    `/api/v1/auth/passkeys/${encodeURIComponent(passkeyID)}`,
    {
      method: "DELETE",
    },
    "protected",
  );
}

export async function signInWithPasskey(username: string): Promise<FinishPasskeyAuthenticationResponse> {
  if (!supportsPasskeys()) {
    throw new Error("This browser does not support passkeys");
  }

  const { state, publicKey } = await nativePasskeyRequest<BeginPasskeyAuthenticationResponse>(
    "/api/v1/auth/passkeys/authentication/begin",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
    "public",
  );

  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(publicKey),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey sign in was cancelled");
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return await nativePasskeyRequest<FinishPasskeyAuthenticationResponse>(
    "/api/v1/auth/passkeys/authentication/finish",
    {
      method: "POST",
      body: JSON.stringify({
        state,
        credential: {
          id: bufferToBase64url(credential.rawId),
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            authenticatorData: bufferToBase64url(response.authenticatorData),
            signature: bufferToBase64url(response.signature),
            userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : "",
          },
        },
      }),
    },
    "public",
  );
}

export { supportsPasskeys };
