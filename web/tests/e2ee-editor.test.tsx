import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EncryptedMemoEditor } from "../src/components/MemoEditor/EncryptedMemoEditor";
import { createVault, decodeMemo, decryptMemo, encodeRecord, encryptMemo } from "../src/lib/e2ee/crypto";
import { VaultSession } from "../src/lib/e2ee/session";
import { MemoSchema } from "../src/types/proto/api/memo_service_pb";

const mocks = vi.hoisted(() => ({ session: undefined as unknown as VaultSession, create: vi.fn(), update: vi.fn() }));
vi.mock("../src/contexts/E2EEContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useVaultSession: () => ({ session: mocks.session, ...useSyncExternalStore(mocks.session.subscribe, mocks.session.getSnapshot) }),
    lockEncryption: vi.fn(),
  };
});
vi.mock("../src/hooks/useMemoQueries", () => ({
  useCreateMemo: () => ({ mutateAsync: mocks.create }),
  useUpdateMemo: () => ({ mutateAsync: mocks.update }),
}));
vi.mock("../src/components/Encryption/VaultPanel", () => ({ VaultPanel: () => <div>vault-locked</div> }));
vi.mock("../src/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-router-dom", () => ({ useBlocker: () => ({ state: "unblocked" }) }));
beforeEach(() => {
  mocks.session = new VaultSession();
  mocks.session.setOwner("users/alice");
  mocks.create.mockReset();
  mocks.update.mockReset();
  localStorage.clear();
});
it("keeps locked memos opaque", () => {
  render(<EncryptedMemoEditor />);
  expect(screen.getByText("vault-locked")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("saves ciphertext only and never persists an encrypted draft", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  mocks.create.mockResolvedValue(create(MemoSchema, { name: "memos/test" }));
  render(<EncryptedMemoEditor editing />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "private body canary" } });
  expect(JSON.stringify(localStorage)).not.toContain("private body canary");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  const request = mocks.create.mock.calls[0][0];
  expect(request.memo.content).toBe("");
  expect(await decryptMemo(vault.key, decodeMemo(request.memo.encryptedContent))).toBe("private body canary");
});
it("renders Markdown as inert text without remote images or previews", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const content = "![secret](https://example.test/tracker) <iframe src='https://example.test'></iframe>";
  const envelope = await encryptMemo(vault.key, vault.record.id, content);
  render(<EncryptedMemoEditor memo={create(MemoSchema, { name: "memos/a", encryptedContent: encodeRecord(envelope) })} />);
  await waitFor(() => expect(screen.getByText(content)).toBeInTheDocument());
  expect(document.querySelector("img,iframe,video,audio")).toBeNull();
});

it("does not revive a draft when its save resolves after an account switch", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  let resolve!: (memo: ReturnType<typeof create<typeof MemoSchema>>) => void;
  mocks.create.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const confirmed = vi.fn();
  render(<EncryptedMemoEditor editing onConfirm={confirmed} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "unsaved private canary" } });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  act(() => mocks.session.setOwner("users/bob"));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await act(async () => resolve(create(MemoSchema, { name: "memos/saved" })));
  expect(confirmed).not.toHaveBeenCalled();
  expect(screen.queryByText("unsaved private canary")).not.toBeInTheDocument();
});
