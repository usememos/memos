// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createVault, decryptMemo, encodeRecord, encryptMemo } from "../src/lib/e2ee/crypto";
import { canUsePasskeys, createPasskey, decodePasskey, unlockWithPasskey, unwrapPasskey, wrapPasskey } from "../src/lib/e2ee/passkey";

const credentials = { create: vi.fn(), get: vi.fn() };
const prf = () => new Uint8Array(32).fill(7);
const credential = (id = "AQID", output: Uint8Array | undefined = prf()) => ({
  type: "public-key",
  id,
  rawId: Uint8Array.from(Buffer.from(id, "base64url")).buffer,
  getClientExtensionResults: () => ({ prf: output ? { enabled: true, results: { first: output.buffer } } : { enabled: false } }),
});
const metadata = () => ({
  version: 1 as const,
  id: crypto.randomUUID(),
  vaultId: crypto.randomUUID(),
  credentialId: "AQID",
  rpId: "localhost",
  salt: Buffer.from(new Uint8Array(32).fill(4)).toString("base64"),
});
beforeEach(() => {
  vi.stubGlobal("navigator", { credentials });
  vi.stubGlobal("PublicKeyCredential", class {});
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("location", { hostname: "localhost" });
  credentials.create.mockReset().mockResolvedValue(credential());
  credentials.get.mockReset().mockResolvedValue(credential());
});
afterEach(() => vi.unstubAllGlobals());
it("wraps the existing vault key and binds all metadata to authenticated encryption", async () => {
  const vault = await createVault("separate passphrase for testing");
  const meta = { ...metadata(), vaultId: vault.record.id };
  const record = await wrapPasskey(vault.key, meta, prf());
  const body = await encryptMemo(vault.key, vault.record.id, "secret body");
  const key = await unwrapPasskey(decodePasskey(encodeRecord(record)), prf());
  expect(await decryptMemo(key, body)).toBe("secret body");
  expect(JSON.stringify(record)).not.toContain(Buffer.from(prf()).toString("base64"));
  await expect(unwrapPasskey(record, new Uint8Array(32).fill(8))).rejects.toThrow();
  for (const patch of [{ vaultId: crypto.randomUUID() }, { id: crypto.randomUUID() }, { credentialId: "BAUG" }, { rpId: "other.test" }]) {
    await expect(unwrapPasskey({ ...record, ...patch }, prf())).rejects.toThrow();
  }
});
it("requires user verification and proves PRF support with an assertion before enrollment", async () => {
  const vault = await createVault("separate passphrase for testing");
  const record = await createPasskey(vault.key, vault.record.id, "users/alice");
  expect(record.credentialId).toBe("AQID");
  expect(credentials.create.mock.calls[0][0].publicKey.authenticatorSelection).toEqual({
    residentKey: "required",
    userVerification: "required",
  });
  const request = credentials.get.mock.calls[0][0].publicKey;
  expect(request.userVerification).toBe("required");
  expect(request.rpId).toBe("localhost");
  expect(request.extensions.prf.evalByCredential.AQID.first).toHaveLength(32);
  expect(request.allowCredentials).toHaveLength(1);
  const body = await encryptMemo(vault.key, vault.record.id, "private text");
  expect(await decryptMemo(await unlockWithPasskey([record], vault.record.id), body)).toBe("private text");
});
it("falls back safely when PRF is absent or malformed, without producing a wrapper", async () => {
  const vault = await createVault("separate passphrase for testing");
  credentials.create.mockResolvedValue({ ...credential(), getClientExtensionResults: () => ({}) });
  await expect(createPasskey(vault.key, vault.record.id, "users/alice")).rejects.toThrow();
  credentials.create.mockResolvedValue(credential());
  credentials.get.mockResolvedValue(credential("AQID", new Uint8Array(16)));
  await expect(createPasskey(vault.key, vault.record.id, "users/alice")).rejects.toThrow();
});
it("filters origin/vault mismatches and rejects an unexpected selected credential", async () => {
  const vault = await createVault("separate passphrase for testing");
  const record = await createPasskey(vault.key, vault.record.id, "users/alice");
  credentials.get.mockClear();
  await expect(unlockWithPasskey([{ ...record, rpId: "other.test" }], vault.record.id)).rejects.toThrow();
  await expect(unlockWithPasskey([record], crypto.randomUUID())).rejects.toThrow();
  expect(credentials.get).not.toHaveBeenCalled();
  credentials.get.mockResolvedValue(credential("BAUG"));
  await expect(unlockWithPasskey([record], vault.record.id)).rejects.toThrow();
});
it("does not enroll after cancellation, including authenticators ignoring AbortSignal", async () => {
  const vault = await createVault("separate passphrase for testing");
  const controller = new AbortController();
  credentials.create.mockImplementation(async () => {
    controller.abort();
    return credential();
  });
  await expect(createPasskey(vault.key, vault.record.id, "users/alice", controller.signal)).rejects.toThrow();
  expect(credentials.get).not.toHaveBeenCalled();
});
it("strictly bounds records and only offers secure non-IP origins", async () => {
  const vault = await createVault("separate passphrase for testing");
  const record = await createPasskey(vault.key, vault.record.id, "users/alice");
  for (const patch of [
    { secret: "must not accept" },
    { credentialId: "AQID=" },
    { rpId: "https://localhost" },
    { salt: "AA==" },
    { version: 2 },
  ]) {
    expect(() => decodePasskey(encodeRecord({ ...record, ...patch }))).toThrow();
  }
  expect(canUsePasskeys()).toBe(true);
  vi.stubGlobal("location", { hostname: "127.0.0.1" });
  expect(canUsePasskeys()).toBe(false);
  vi.stubGlobal("location", { hostname: "localhost" });
  vi.stubGlobal("isSecureContext", false);
  expect(canUsePasskeys()).toBe(false);
});

it("excludes existing credentials so a cancelled second enrollment cannot replace them", async () => {
  const vault = await createVault("separate passphrase for testing");
  const existing = await createPasskey(vault.key, vault.record.id, "users/alice");
  credentials.create.mockResolvedValue(credential("BAUG"));
  credentials.get.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
  await expect(createPasskey(vault.key, vault.record.id, "users/alice", undefined, [existing])).rejects.toThrow();
  expect(credentials.create.mock.calls[1][0].publicKey.user.id).not.toEqual(credentials.create.mock.calls[0][0].publicKey.user.id);
  expect(credentials.create.mock.calls[1][0].publicKey.excludeCredentials).toEqual([{ type: "public-key", id: new Uint8Array([1, 2, 3]) }]);
});
