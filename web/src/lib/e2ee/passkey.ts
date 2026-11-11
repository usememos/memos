import { encodeRecord, type Sealed } from "./crypto";

/** A public credential locator and client-wrapped vault key, never a PRF output. */
export interface PasskeyRecord {
  version: 1;
  id: string;
  vaultId: string;
  credentialId: string;
  rpId: string;
  salt: string;
  key: Sealed;
}
/** Rejects malformed passkey records without including sensitive input in the error. */
const invalid = (): never => {
  throw new Error("Invalid passkey wrapper");
};
export class PasskeyUnavailableError extends Error {
  constructor() {
    super("Passkey PRF unavailable");
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
/** Accepts record objects while rejecting arrays and null. */
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** Requires the exact fields of a supported passkey record. */
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  object(v) && Object.keys(v).length === keys.length && keys.every((key) => Object.hasOwn(v, key));
/** Encodes the bounded salt and wrapped-key bytes as padded base64. */
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
/** Decodes canonical padded base64 for protocol fields. */
const from64 = (s: string): Uint8Array<ArrayBuffer> => {
  if (typeof s !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) invalid();
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  if (b64(bytes) !== s) invalid();
  return bytes;
};
/** Encodes credential identifiers using unpadded base64url. */
const url64 = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** Decodes and bounds canonical unpadded credential identifiers. */
const fromURL64 = (s: string): Uint8Array<ArrayBuffer> => {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,1366}$/.test(s)) invalid();
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bytes = from64(padded);
  if (bytes.length < 1 || bytes.length > 1024 || url64(bytes) !== s) invalid();
  return bytes;
};
/** Validates the version, identifiers, RP hostname, salt, and wrapped-key sizes. */
export function decodePasskey(bytes: Uint8Array): PasskeyRecord {
  if (bytes.length > 4096) invalid();
  const v = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !exact(v, ["version", "id", "vaultId", "credentialId", "rpId", "salt", "key"]) ||
    v.version !== 1 ||
    typeof v.id !== "string" ||
    !uuid.test(v.id) ||
    typeof v.vaultId !== "string" ||
    !uuid.test(v.vaultId) ||
    typeof v.credentialId !== "string" ||
    typeof v.rpId !== "string" ||
    v.rpId.length > 253 ||
    !hostname.test(v.rpId) ||
    typeof v.salt !== "string" ||
    from64(v.salt).length !== 32 ||
    !exact(v.key, ["nonce", "ciphertext"]) ||
    typeof v.key.nonce !== "string" ||
    from64(v.key.nonce).length !== 12 ||
    typeof v.key.ciphertext !== "string" ||
    from64(v.key.ciphertext).length !== 48
  )
    invalid();
  fromURL64(v.credentialId as string);
  return v as unknown as PasskeyRecord;
}
/** Binds a wrapper to its vault, credential, RP, and enrollment identity. */
const context = (r: Omit<PasskeyRecord, "key">) => encodeRecord(["memos-e2ee", 1, "passkey-key", r.vaultId, r.id, r.credentialId, r.rpId]);
/** Derives a local AES-GCM wrapping key from PRF output and enrollment context. */
const wrappingKey = async (r: Omit<PasskeyRecord, "key">, prf: Uint8Array<ArrayBuffer>) => {
  if (prf.length !== 32) invalid();
  const input = await crypto.subtle.importKey("raw", prf, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: from64(r.salt), info: context(r) },
    input,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};
/** Wraps and verifies a vault key locally without serializing the PRF output. */
export async function wrapPasskey(key: CryptoKey, meta: Omit<PasskeyRecord, "key">, prf: Uint8Array<ArrayBuffer>): Promise<PasskeyRecord> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: context(meta), tagLength: 128 },
      await wrappingKey(meta, prf),
      raw,
    );
    const record = decodePasskey(encodeRecord({ ...meta, key: { nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) } }));
    const checked = new Uint8Array(await crypto.subtle.exportKey("raw", await unwrapPasskey(record, prf)));
    try {
      if (checked.length !== raw.length || !checked.every((byte, i) => byte === raw[i])) invalid();
    } finally {
      checked.fill(0);
    }
    return record;
  } finally {
    raw.fill(0);
  }
}
/** Authenticates and unwraps the vault key using the credential PRF output. */
export async function unwrapPasskey(record: PasskeyRecord, prf: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const r = decodePasskey(encodeRecord(record));
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: from64(r.key.nonce), additionalData: context(r), tagLength: 128 },
      await wrappingKey(r, prf),
      from64(r.key.ciphertext),
    ),
  );
  try {
    return await crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
  } finally {
    raw.fill(0);
  }
}
/** A platform check only. Actual PRF support is established by enrollment/get. */
export function canUsePasskeys(): boolean {
  return (
    typeof isSecureContext !== "undefined" &&
    isSecureContext &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials?.create &&
    !!navigator.credentials?.get &&
    typeof location !== "undefined" &&
    hostname.test(location.hostname) &&
    !/^\d+(\.\d+){3}$/.test(location.hostname)
  );
}
/** Requires a public-key credential result from the browser. */
function credentialResult(value: Credential | null): PublicKeyCredential {
  if (!value || value.type !== "public-key") throw new PasskeyUnavailableError();
  const credential = value as PublicKeyCredential;
  if (!(credential.rawId instanceof ArrayBuffer) || url64(new Uint8Array(credential.rawId)) !== credential.id) invalid();
  fromURL64(credential.id);
  return credential;
}
/** Requires a supported PRF result of the expected key length. */
function prfResult(credential: PublicKeyCredential): Uint8Array<ArrayBuffer> {
  const output = credential.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  if (!(output.prf?.results?.first instanceof ArrayBuffer) || output.prf.results.first.byteLength !== 32)
    throw new PasskeyUnavailableError();
  return new Uint8Array(output.prf.results.first).slice();
}
/** Combines caller cancellation with a timeout and cleans up credential-request listeners. */
async function request<T>(signal: AbortSignal | undefined, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 60000);
  try {
    const result = await operation(controller.signal);
    controller.signal.throwIfAborted();
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
/** Enrolls and verifies a discoverable PRF credential before returning its wrapped vault key. */
export async function createPasskey(
  key: CryptoKey,
  vaultId: string,
  owner: string,
  signal?: AbortSignal,
  existing: PasskeyRecord[] = [],
): Promise<PasskeyRecord> {
  if (!canUsePasskeys()) throw new PasskeyUnavailableError();
  if (!uuid.test(vaultId) || !owner) invalid();
  const rpId = location.hostname;
  const salt = crypto.getRandomValues(new Uint8Array(32));
  if (existing.length > 10) invalid();
  const excludeCredentials: PublicKeyCredentialDescriptor[] = existing
    .map((record) => decodePasskey(encodeRecord(record)))
    .filter((record) => record.vaultId === vaultId && record.rpId === rpId)
    .map((record) => ({ type: "public-key", id: fromURL64(record.credentialId) }));
  // Each registration gets its own user handle: even a stale list or an abandoned
  // concurrent enrollment must never replace a working discoverable credential.
  const userId = crypto.getRandomValues(new Uint8Array(32));
  const created = credentialResult(
    await request(signal, (requestSignal) =>
      navigator.credentials.create({
        signal: requestSignal,
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { id: rpId, name: "Memos" },
          user: { id: userId, name: owner, displayName: owner },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          excludeCredentials,
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          attestation: "none",
          timeout: 60000,
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      }),
    ),
  );
  const extensions = created.getClientExtensionResults() as { prf?: { enabled?: boolean } };
  if (extensions.prf?.enabled !== true) throw new PasskeyUnavailableError();
  const meta: Omit<PasskeyRecord, "key"> = {
    version: 1,
    id: crypto.randomUUID(),
    vaultId,
    credentialId: created.id,
    rpId,
    salt: b64(salt),
  };
  const verified = await getPRF([meta], signal);
  try {
    const record = await wrapPasskey(key, meta, verified.output);
    signal?.throwIfAborted();
    return record;
  } finally {
    verified.output.fill(0);
  }
}
/** Requests user verification for eligible credentials and identifies the returned PRF output. */
async function getPRF(records: Omit<PasskeyRecord, "key">[], signal?: AbortSignal) {
  const evalByCredential = Object.fromEntries(records.map((r) => [r.credentialId, { first: from64(r.salt) }]));
  const selected = credentialResult(
    await request(signal, (requestSignal) =>
      navigator.credentials.get({
        signal: requestSignal,
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: location.hostname,
          userVerification: "required",
          timeout: 60000,
          allowCredentials: records.map((r) => ({ type: "public-key", id: fromURL64(r.credentialId) })),
          extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
        },
      }),
    ),
  );
  const record = records.find((r) => r.credentialId === selected.id);
  if (!record) return invalid();
  return { id: record.id, output: prfResult(selected) };
}
/** Selects current-site vault credentials and unwraps the key after user verification. */
export async function unlockWithPasskey(records: PasskeyRecord[], vaultId: string, signal?: AbortSignal): Promise<CryptoKey> {
  if (!canUsePasskeys()) throw new PasskeyUnavailableError();
  if (records.length > 10) invalid();
  const eligible = records.map((r) => decodePasskey(encodeRecord(r))).filter((r) => r.vaultId === vaultId && r.rpId === location.hostname);
  if (!eligible.length) throw new PasskeyUnavailableError();
  const selected = await getPRF(eligible, signal);
  try {
    const record = eligible.find((r) => r.id === selected.id);
    if (!record) return invalid();
    const key = await unwrapPasskey(record, selected.output);
    signal?.throwIfAborted();
    return key;
  } finally {
    selected.output.fill(0);
  }
}
