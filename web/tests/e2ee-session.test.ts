import { expect, it } from "vitest";
import { VaultSession } from "../src/lib/e2ee/session";

it("rejects an unlock that completes after locking or switching accounts", async () => {
  const session = new VaultSession();
  session.setOwner("users/alice");
  const attempt = session.ticket();
  session.lock();
  expect(session.accept(attempt, {} as CryptoKey, "vault")).toBe(false);
  const next = session.ticket();
  session.setOwner("users/bob");
  expect(session.accept(next, {} as CryptoKey, "vault")).toBe(false);
  const current = session.ticket();
  expect(session.accept(current, {} as CryptoKey, "vault")).toBe(true);
  expect(session.getSnapshot().key).toBeDefined();
  session.lock();
  expect(session.getSnapshot().key).toBeUndefined();
});
