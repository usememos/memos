import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { VaultPanel } from "../src/components/Encryption/VaultPanel";
import { createVault, decodeVault, encodeRecord, unlockVault } from "../src/lib/e2ee/crypto";
import { VaultSession } from "../src/lib/e2ee/session";

const api = vi.hoisted(() => ({ getEncryptionVault: vi.fn(), createEncryptionVault: vi.fn(), updateEncryptionVault: vi.fn() }));
const state = vi.hoisted(() => ({ session: undefined as unknown as VaultSession }));
vi.mock("../src/connect", () => ({ userServiceClient: api }));
vi.mock("../src/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("../src/contexts/E2EEContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useVaultSession: () => ({ session: state.session, ...useSyncExternalStore(state.session.subscribe, state.session.getSnapshot) }),
    lockEncryption: vi.fn(),
  };
});
beforeEach(() => {
  state.session = new VaultSession();
  state.session.setOwner("users/owner");
  vi.clearAllMocks();
});
it("requires recovery confirmation before creating a vault and sends wrapped keys only", async () => {
  api.getEncryptionVault.mockRejectedValue(new ConnectError("not configured", Code.NotFound));
  api.createEncryptionVault.mockImplementation(async (request) => request);
  render(<VaultPanel />);
  const password = await screen.findByLabelText("e2ee.passphrase");
  fireEvent.change(password, { target: { value: "separate private passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: "e2ee.setup" }));
  const secret = await screen.findByLabelText("e2ee.recovery-key");
  expect(api.createEncryptionVault).not.toHaveBeenCalled();
  const recoverySecret = (secret as HTMLTextAreaElement).value;
  fireEvent.change(screen.getByLabelText("e2ee.confirm-recovery"), { target: { value: recoverySecret } });
  fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
  await waitFor(() => expect(api.createEncryptionVault).toHaveBeenCalledOnce());
  const record = api.createEncryptionVault.mock.calls[0][0].vault;
  const serialized = new TextDecoder().decode(record);
  expect(serialized).not.toContain("separate private passphrase");
  expect(serialized).not.toContain(recoverySecret);
  expect(await unlockVault(decodeVault(record), "separate private passphrase")).toBeDefined();
  expect(state.session.getSnapshot().key).toBeDefined();
});
it("unlocks using a recovery key without sending that key to the server", async () => {
  const created = await createVault("separate private passphrase");
  api.getEncryptionVault.mockResolvedValue({ vault: encodeRecord(created.record) });
  render(<VaultPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "e2ee.recovery-key" }));
  fireEvent.change(screen.getByLabelText("e2ee.recovery-key"), { target: { value: created.recoverySecret } });
  fireEvent.click(screen.getByRole("button", { name: "e2ee.unlock" }));
  await waitFor(() => expect(state.session.getSnapshot().key).toBeDefined());
  expect(api.createEncryptionVault).not.toHaveBeenCalled();
  expect(api.updateEncryptionVault).not.toHaveBeenCalled();
});
