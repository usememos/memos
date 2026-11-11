/** Versioned client-only protocol. Network callers receive only serialized ciphertext. */
export interface Sealed {
  nonce: string;
  ciphertext: string;
}
export interface VaultRecord {
  version: 1;
  id: string;
  revision: string;
  salt: string;
  passphraseKey: Sealed;
  recoveryKey: Sealed;
}
export interface EncryptedMemo {
  version: 1;
  vaultId: string;
  objectId: string;
  revisionId: string;
  body: Sealed;
  dataKey: Sealed;
}
export const MAX_BODY_BYTES = 1024 * 1024;
const utf8 = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Rejects malformed protocol records without exposing their contents. */
const fail = (): never => {
  throw new Error("Invalid encrypted record");
};
/** Serializes versioned ciphertext records as UTF-8 JSON for transport. */
export const encodeRecord = (value: unknown): Uint8Array<ArrayBuffer> => utf8.encode(JSON.stringify(value));
/** Encodes bytes in bounded chunks to avoid argument limits for large memo bodies. */
const base64 = (bytes: Uint8Array) => {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(result);
};
/** Decodes only canonical padded base64, rejecting alternate representations. */
const unbase64 = (value: string): Uint8Array<ArrayBuffer> => {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail();
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (base64(bytes) !== value) fail();
  return bytes;
};
/** Generates cryptographically random key, salt, or nonce bytes. */
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));
/** Imports an AES-GCM key for local encryption and vault wrapping. */
const importKey = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
/** Binds ciphertext to its protocol purpose, vault, object, and revision. */
const aad = (purpose: string, vaultId: string, objectId = "", revisionId = "") =>
  encodeRecord(["memos-e2ee", 1, purpose, vaultId, objectId, revisionId]);
/** Encrypts bytes with a fresh nonce and authenticates their supplied context. */
const seal = async (key: CryptoKey, bytes: Uint8Array<ArrayBuffer>, context: Uint8Array<ArrayBuffer>): Promise<Sealed> => {
  const nonce = random(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: context, tagLength: 128 }, key, bytes);
  return { nonce: base64(nonce), ciphertext: base64(new Uint8Array(ciphertext)) };
};
/** Authenticates and decrypts a sealed record under its expected context. */
const open = async (key: CryptoKey, sealed: Sealed, context: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unbase64(sealed.nonce), additionalData: context, tagLength: 128 },
      key,
      unbase64(sealed.ciphertext),
    ),
  );
/** Accepts JSON objects but excludes null and arrays. */
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
/** Rejects missing or unexpected fields in a versioned protocol object. */
const exactKeys = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
/** Checks canonical lowercase UUIDv4 identifiers used by the protocol. */
const validID = (value: unknown) => typeof value === "string" && uuid.test(value);
/** Bounds nonce and ciphertext sizes, including fixed-size wrapped keys. */
const validSealed = (value: unknown, key: boolean): boolean => {
  if (!exactKeys(value, ["nonce", "ciphertext"]) || typeof value.nonce !== "string" || typeof value.ciphertext !== "string") return false;
  if (value.ciphertext.length > 4 * Math.ceil((MAX_BODY_BYTES + 16) / 3)) return false;
  const length = unbase64(value.ciphertext).length;
  return unbase64(value.nonce).length === 12 && (key ? length === 48 : length >= 16 && length <= MAX_BODY_BYTES + 16);
};
/** Parses a bounded v1 vault record and validates its exact schema. */
export const decodeVault = (bytes: Uint8Array): VaultRecord => {
  if (bytes.length > 4096) fail();
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !exactKeys(value, ["version", "id", "revision", "salt", "passphraseKey", "recoveryKey"]) ||
    value.version !== 1 ||
    !validID(value.id) ||
    !validID(value.revision) ||
    typeof value.salt !== "string" ||
    unbase64(value.salt).length !== 16 ||
    !validSealed(value.passphraseKey, true) ||
    !validSealed(value.recoveryKey, true)
  )
    fail();
  return value as unknown as VaultRecord;
};
/** Parses a bounded v1 memo envelope without accepting unknown fields. */
export const decodeMemo = (bytes: Uint8Array): EncryptedMemo => {
  if (bytes.length > 1572864) fail();
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !exactKeys(value, ["version", "vaultId", "objectId", "revisionId", "body", "dataKey"]) ||
    value.version !== 1 ||
    !validID(value.vaultId) ||
    !validID(value.objectId) ||
    !validID(value.revisionId) ||
    !validSealed(value.body, false) ||
    !validSealed(value.dataKey, true)
  )
    fail();
  return value as unknown as EncryptedMemo;
};
/** Derives a wrapping key with the fixed Argon2id profile in a bounded-lifetime worker. */
const derive = async (password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => {
  if (!password || password.length > 1024) throw new Error("Invalid encryption passphrase");
  let raw: Uint8Array<ArrayBuffer>;
  if (typeof Worker !== "undefined") {
    raw = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./kdf.worker.ts", import.meta.url), { type: "module" });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Key derivation timed out"));
      }, 60000);
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        worker.terminate();
        if (data.error) reject(new Error("Key derivation failed"));
        else resolve(new Uint8Array(data.key));
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error("Key derivation failed"));
      };
      worker.postMessage({ password, salt });
    });
  } else {
    // Node test harness; supported browsers must provide workers.
    if (typeof window !== "undefined" && !import.meta.env.MODE.includes("test")) throw new Error("Web Workers required");
    const { deriveArgonKey } = await import("./kdf");
    raw = new Uint8Array(await deriveArgonKey(password, salt));
  }
  try {
    return await importKey(raw);
  } finally {
    raw.fill(0);
  }
};
/** Formats bytes as lowercase hexadecimal for recovery-key display. */
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
/** Adds a checksum to the recovery secret so transcription errors can be detected. */
const recoveryText = async (bytes: Uint8Array<ArrayBuffer>) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `${hex(bytes)}-${hex(digest.subarray(0, 4))}`;
};
/** Validates a recovery secret and its checksum before importing it. */
const recoveryBytes = async (secret: string) => {
  const normalized = secret.trim().toLowerCase();
  if (!/^[0-9a-f]{64}-[0-9a-f]{8}$/.test(normalized)) fail();
  const bytes = Uint8Array.from(normalized.slice(0, 64).match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  if ((await recoveryText(bytes)) !== normalized) fail();
  return bytes;
};
/** Creates independent random vault and recovery keys, returning only wrapped keys for persistence. */
export const createVault = async (passphrase: string): Promise<{ record: VaultRecord; key: CryptoKey; recoverySecret: string }> => {
  const id = crypto.randomUUID();
  const salt = random(16);
  const raw = random(32);
  const recovery = random(32);
  try {
    const key = await importKey(raw);
    return {
      record: {
        version: 1,
        id,
        revision: crypto.randomUUID(),
        salt: base64(salt),
        passphraseKey: await seal(await derive(passphrase, salt), raw, aad("passphrase-key", id)),
        recoveryKey: await seal(await importKey(recovery), raw, aad("recovery-key", id)),
      },
      key,
      recoverySecret: await recoveryText(recovery),
    };
  } finally {
    raw.fill(0);
    recovery.fill(0);
  }
};
/** Locally unwraps the vault key using the encryption passphrase. */
export const unlockVault = async (record: VaultRecord, passphrase: string): Promise<CryptoKey> => {
  decodeVault(encodeRecord(record));
  const raw = await open(await derive(passphrase, unbase64(record.salt)), record.passphraseKey, aad("passphrase-key", record.id));
  try {
    return await importKey(raw);
  } finally {
    raw.fill(0);
  }
};
/** Locally unwraps the vault key using the user-held recovery secret. */
export const recoverVault = async (record: VaultRecord, secret: string): Promise<CryptoKey> => {
  decodeVault(encodeRecord(record));
  const recovery = await recoveryBytes(secret);
  try {
    const raw = await open(await importKey(recovery), record.recoveryKey, aad("recovery-key", record.id));
    try {
      return await importKey(raw);
    } finally {
      raw.fill(0);
    }
  } finally {
    recovery.fill(0);
  }
};
/** Rewraps the existing vault key with a fresh salt while preserving recovery access. */
export const changePassphrase = async (record: VaultRecord, key: CryptoKey, passphrase: string): Promise<VaultRecord> => {
  decodeVault(encodeRecord(record));
  const salt = random(16);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  try {
    return {
      ...record,
      revision: crypto.randomUUID(),
      salt: base64(salt),
      passphraseKey: await seal(await derive(passphrase, salt), raw, aad("passphrase-key", record.id)),
    };
  } finally {
    raw.fill(0);
  }
};
/** Encrypts a revision with a fresh data key and wraps that key under the vault key. */
export const encryptMemo = async (
  key: CryptoKey,
  vaultId: string,
  plaintext: string,
  objectId: string = crypto.randomUUID(),
): Promise<EncryptedMemo> => {
  if (!validID(vaultId) || !validID(objectId)) fail();
  const bytes = utf8.encode(plaintext);
  if (bytes.length > MAX_BODY_BYTES) throw new Error("Encrypted memo is too large");
  const revisionId = crypto.randomUUID();
  const raw = random(32);
  try {
    return {
      version: 1,
      vaultId,
      objectId,
      revisionId,
      body: await seal(await importKey(raw), bytes, aad("body", vaultId, objectId, revisionId)),
      dataKey: await seal(key, raw, aad("data-key", vaultId, objectId, revisionId)),
    };
  } finally {
    raw.fill(0);
    bytes.fill(0);
  }
};
/** Unwraps a memo data key and authenticates its body and revision context. */
export const decryptMemo = async (key: CryptoKey, encrypted: EncryptedMemo): Promise<string> => {
  const record = decodeMemo(encodeRecord(encrypted));
  const raw = await open(key, record.dataKey, aad("data-key", record.vaultId, record.objectId, record.revisionId));
  try {
    const bytes = await open(await importKey(raw), record.body, aad("body", record.vaultId, record.objectId, record.revisionId));
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } finally {
      bytes.fill(0);
    }
  } finally {
    raw.fill(0);
  }
};
