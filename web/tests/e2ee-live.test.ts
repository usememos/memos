// @vitest-environment node
import { expect, it } from "vitest";
import { createVault, decodeMemo, decodeVault, decryptMemo, encodeRecord, encryptMemo, unlockVault } from "../src/lib/e2ee/crypto";

// Opt-in against a disposable local instance, never the user's database.
const endpoint = process.env.E2EE_SMOKE_URL;
it.skipIf(!endpoint)("round-trips real client ciphertext through a local Memos server", async () => {
  if (!endpoint || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(endpoint)) throw new Error("Disposable localhost instance required");
  let token = "";
  const call = async (service: string, method: string, body: unknown) => {
    const response = await fetch(`${endpoint}/memos.api.${service}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`${method}: ${response.status} ${result.message}`);
    return result;
  };
  const username = `e2ee-smoke-${Date.now()}`;
  const password = "local-disposable-login-password";
  await call("UserService", "CreateUser", { user: { username, password, email: `${username}@example.invalid` } });
  const signedIn = await call("AuthService", "SignIn", { passwordCredentials: { username, password } });
  token = signedIn.accessToken;
  const vault = await createVault("local-disposable-encryption-passphrase");
  await call("UserService", "CreateEncryptionVault", { vault: Buffer.from(encodeRecord(vault.record)).toString("base64") });
  const envelope = await encryptMemo(vault.key, vault.record.id, "E2EE live smoke canary — 비공개 본문");
  const memo = await call("MemoService", "CreateMemo", {
    memo: {
      visibility: "PRIVATE",
      encryptedTitle: "Visible title — 공개 제목",
      encryptedContent: Buffer.from(encodeRecord(envelope)).toString("base64"),
    },
  });
  expect(memo.content || "").toBe("");
  const stored = await call("MemoService", "GetMemo", { name: memo.name });
  expect(stored.encryptedTitle).toBe("Visible title — 공개 제목");
  expect(JSON.stringify(stored)).not.toContain("비공개 본문");
  const otherDeviceVault = await call("UserService", "GetEncryptionVault", {});
  const otherDeviceKey = await unlockVault(
    decodeVault(Buffer.from(otherDeviceVault.vault, "base64")),
    "local-disposable-encryption-passphrase",
  );
  expect(await decryptMemo(otherDeviceKey, decodeMemo(Buffer.from(stored.encryptedContent, "base64")))).toBe(
    "E2EE live smoke canary — 비공개 본문",
  );
  const next = await encryptMemo(otherDeviceKey, vault.record.id, "E2EE edited canary", envelope.objectId);
  await call("MemoService", "UpdateMemo", {
    memo: { name: memo.name, encryptedTitle: "Edited title", encryptedContent: Buffer.from(encodeRecord(next)).toString("base64") },
    updateMask: "encryptedContent,encryptedTitle",
    expectedEncryptionRevision: envelope.revisionId,
  });
  const updated = await call("MemoService", "GetMemo", { name: memo.name });
  expect(updated.encryptedTitle).toBe("Edited title");
  expect(await decryptMemo(otherDeviceKey, decodeMemo(Buffer.from(updated.encryptedContent, "base64")))).toBe("E2EE edited canary");
  console.info(`Disposable UI fixture: ${username}`);
});
