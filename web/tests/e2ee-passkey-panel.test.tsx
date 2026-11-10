import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PasskeyPanel } from "../src/components/Encryption/PasskeyPanel";
import { createVault, encodeRecord } from "../src/lib/e2ee/crypto";
import { VaultSession } from "../src/lib/e2ee/session";

const mocks = vi.hoisted(() => ({
  session: undefined as unknown as VaultSession,
  records: [] as Uint8Array[],
  add: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  unlock: vi.fn(),
  supported: true,
}));
vi.mock("../src/contexts/E2EEContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useVaultSession: () => ({ session: mocks.session, ...useSyncExternalStore(mocks.session.subscribe, mocks.session.getSnapshot) }),
  };
});
vi.mock("../src/hooks/useEncryptionPasskeyQueries", () => ({
  useEncryptionPasskeys: () => ({ data: { passkeys: mocks.records }, isPending: false, isError: false }),
  useCreateEncryptionPasskey: () => ({ mutateAsync: mocks.add }),
  useDeleteEncryptionPasskey: () => ({ mutateAsync: mocks.remove }),
}));
vi.mock("../src/lib/e2ee/passkey", () => ({
  canUsePasskeys: () => mocks.supported,
  createPasskey: (...args: unknown[]) => mocks.create(...args),
  unlockWithPasskey: (...args: unknown[]) => mocks.unlock(...args),
  decodePasskey: (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)),
  PasskeyUnavailableError: class extends Error {},
}));
vi.mock("../src/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
const record = (vaultId: string) => ({
  version: 1,
  id: crypto.randomUUID(),
  vaultId,
  credentialId: "AQID",
  rpId: location.hostname,
  salt: "public salt",
  key: { nonce: "nonce", ciphertext: "wrapped key only" },
});
beforeEach(() => {
  mocks.session = new VaultSession();
  mocks.session.setOwner("users/alice");
  mocks.records = [];
  mocks.supported = true;
  mocks.add.mockReset();
  mocks.remove.mockReset();
  mocks.create.mockReset();
  mocks.unlock.mockReset();
});
it("enrolls only an already unlocked key and sends only its wrapper", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const wrapped = record(vault.record.id);
  mocks.create.mockResolvedValue(wrapped);
  render(<PasskeyPanel vaultId={vault.record.id} />);
  fireEvent.click(screen.getByRole("button", { name: "e2ee.passkey-add" }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
  expect(mocks.add.mock.calls[0][0]).toEqual({ passkey: encodeRecord(wrapped) });
  expect(JSON.stringify(mocks.add.mock.calls[0][0])).not.toContain("separate private passphrase");
});
it("offers passkey unlock without requiring a password and rejects stale account results", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.records = [encodeRecord(record(vault.record.id))];
  const pending = Promise.withResolvers<CryptoKey>();
  mocks.unlock.mockReturnValue(pending.promise);
  const view = render(<PasskeyPanel vaultId={vault.record.id} />);
  expect(screen.queryByRole("button", { name: "e2ee.passkey-add" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "e2ee.passkey-unlock" }));
  act(() => mocks.session.setOwner("users/bob"));
  view.unmount();
  await act(async () => pending.resolve(vault.key));
  expect(mocks.session.getSnapshot().key).toBeUndefined();
  expect(mocks.unlock.mock.calls[0][2].aborted).toBe(true);
});
it("never uploads a wrapper after registration is cancelled or unmounted", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const pending = Promise.withResolvers<ReturnType<typeof record>>();
  mocks.create.mockReturnValue(pending.promise);
  const view = render(<PasskeyPanel vaultId={vault.record.id} />);
  fireEvent.click(screen.getByRole("button", { name: "e2ee.passkey-add" }));
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  view.unmount();
  await act(async () => pending.resolve(record(vault.record.id)));
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls[0][3].aborted).toBe(true);
});
it("leaves fallback guidance in unsupported environments", () => {
  mocks.supported = false;
  render(<PasskeyPanel vaultId={crypto.randomUUID()} />);
  expect(screen.getByText("e2ee.passkey-unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "e2ee.passkey-unlock" })).not.toBeInTheDocument();
});
it("accepts a current passkey unlock result", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.records = [encodeRecord(record(vault.record.id))];
  mocks.unlock.mockResolvedValue(vault.key);
  render(<PasskeyPanel vaultId={vault.record.id} />);
  fireEvent.click(screen.getByRole("button", { name: "e2ee.passkey-unlock" }));
  await waitFor(() => expect(mocks.session.getSnapshot().key).toBe(vault.key));
});

it("prioritizes a registered passkey and reveals fallback methods only on request", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.records = [encodeRecord(record(vault.record.id))];
  render(
    <PasskeyPanel vaultId={vault.record.id}>
      <input aria-label="fallback password" />
    </PasskeyPanel>,
  );
  expect(screen.getByRole("button", { name: "e2ee.passkey-unlock" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "e2ee.unlock-other" }));
  expect(screen.getByLabelText("fallback password")).toBeInTheDocument();
});
it.each(["unsupported", "no-registration"])("shows fallback immediately for %s", (reason) => {
  mocks.supported = reason !== "unsupported";
  render(
    <PasskeyPanel vaultId={crypto.randomUUID()}>
      <input aria-label="fallback password" />
    </PasskeyPanel>,
  );
  expect(screen.getByLabelText("fallback password")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "e2ee.unlock-other" })).not.toBeInTheDocument();
});

it("reveals fallback automatically when the device cannot evaluate PRF", async () => {
  const vault = await createVault("separate private passphrase");
  mocks.records = [encodeRecord(record(vault.record.id))];
  const { PasskeyUnavailableError } = await import("../src/lib/e2ee/passkey");
  mocks.unlock.mockRejectedValue(new PasskeyUnavailableError());
  render(
    <PasskeyPanel vaultId={vault.record.id}>
      <input aria-label="fallback password" />
    </PasskeyPanel>,
  );
  fireEvent.click(screen.getByRole("button", { name: "e2ee.passkey-unlock" }));
  expect(await screen.findByLabelText("fallback password")).toBeInTheDocument();
  expect(screen.getByText("e2ee.passkey-unavailable")).toBeInTheDocument();
});
