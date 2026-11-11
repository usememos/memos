import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EncryptedMemoEditor } from "../src/components/MemoEditor/EncryptedMemoEditor";
import { createVault, decodeMemo, decryptMemo, encodeRecord, encryptMemo } from "../src/lib/e2ee/crypto";
import { VaultSession } from "../src/lib/e2ee/session";
import { MemoSchema } from "../src/types/proto/api/memo_service_pb";

const mocks = vi.hoisted(() => ({
  session: undefined as unknown as VaultSession,
  create: vi.fn(),
  update: vi.fn(),
  updateHook: vi.fn(),
  get: vi.fn(),
}));
vi.mock("../src/connect", () => ({ memoServiceClient: { getMemo: mocks.get } }));
vi.mock("../src/contexts/E2EEContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useVaultSession: () => ({ session: mocks.session, ...useSyncExternalStore(mocks.session.subscribe, mocks.session.getSnapshot) }),
    lockEncryption: vi.fn(),
  };
});
vi.mock("../src/hooks/useMemoQueries", () => ({
  useCreateMemo: () => ({ mutateAsync: mocks.create }),
  useUpdateMemo: (name?: string) => {
    mocks.updateHook(name);
    return { mutateAsync: mocks.update };
  },
}));
vi.mock("../src/components/Encryption/VaultPanel", () => ({ VaultPanel: () => <div>vault-locked</div> }));
vi.mock("../src/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-router-dom", () => ({ useBlocker: () => ({ state: "unblocked" }) }));
beforeEach(() => {
  mocks.session = new VaultSession();
  mocks.session.setOwner("users/alice");
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.get.mockReset();
  mocks.updateHook.mockClear();
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
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.title" }), { target: { value: "private body canary" } });
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
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.title" }), { target: { value: "unsaved private canary" } });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  act(() => mocks.session.setOwner("users/bob"));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await act(async () => resolve(create(MemoSchema, { name: "memos/saved" })));
  expect(confirmed).not.toHaveBeenCalled();
  expect(screen.queryByText("unsaved private canary")).not.toBeInTheDocument();
});

it("shows only a lock and literal optional title until unlock is requested", () => {
  const title = "<img src=x> 제목";
  render(<EncryptedMemoEditor memo={create(MemoSchema, { name: "memos/a", encryptedTitle: title })} />);
  expect(screen.getByRole("button", { name: `e2ee.unlock: ${title}` })).toHaveTextContent(title);
  expect(document.querySelector("img")).toBeNull();
  expect(screen.queryByText("vault-locked")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `e2ee.unlock: ${title}` }));
  expect(screen.getByText("vault-locked")).toBeInTheDocument();
});
it("uses the encrypted memo fallback when a locked memo has no title", () => {
  render(<EncryptedMemoEditor memo={create(MemoSchema, { name: "memos/legacy" })} />);
  expect(screen.getByRole("button", { name: "e2ee.unlock: e2ee.title" })).toHaveTextContent("e2ee.title");
});
it("saves optional titles separately from ciphertext and clears the new draft", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  mocks.create.mockResolvedValue(create(MemoSchema, { name: "memos/test" }));
  render(<EncryptedMemoEditor editing />);
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.memo-title" }), { target: { value: "Visible label" } });
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.title" }), { target: { value: "body secret" } });
  expect(screen.getByText("e2ee.title-notice")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  const request = mocks.create.mock.calls[0][0];
  expect(request.memo.encryptedTitle).toBe("Visible label");
  expect(request.memo.content).toBe("");
  expect(await decryptMemo(vault.key, decodeMemo(request.memo.encryptedContent))).toBe("body secret");
  await waitFor(() => expect(screen.getByRole("textbox", { name: "e2ee.memo-title" })).toHaveValue(""));
});
it("clears an existing title with the same revision-guarded body save", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const envelope = await encryptMemo(vault.key, vault.record.id, "existing secret");
  const memo = create(MemoSchema, { name: "memos/a", encryptedTitle: "Old title", encryptedContent: encodeRecord(envelope) });
  mocks.update.mockResolvedValue(memo);
  render(<EncryptedMemoEditor memo={memo} editing />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "e2ee.title" })).toHaveValue("existing secret"));
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.memo-title" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  const request = mocks.update.mock.calls[0][0];
  expect(request.update.encryptedTitle).toBe("");
  expect(request.updateMask).toContain("encrypted_title");
  expect(request.expectedEncryptionRevision).toBe(envelope.revisionId);
  expect(mocks.updateHook).toHaveBeenLastCalledWith(memo.name);
  expect(await decryptMemo(vault.key, decodeMemo(request.update.encryptedContent))).toBe("existing secret");
});

it("guards a title-only draft against cancellation and discards it on lock", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const envelope = await encryptMemo(vault.key, vault.record.id, "secret body");
  const onCancel = vi.fn();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <EncryptedMemoEditor
      editing
      onCancel={onCancel}
      memo={create(MemoSchema, {
        name: "memos/a",
        encryptedTitle: "Saved title",
        encryptedContent: encodeRecord(envelope),
      })}
    />,
  );
  await waitFor(() => expect(screen.getByRole("textbox", { name: "e2ee.title" })).toHaveValue("secret body"));
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.memo-title" }), { target: { value: "Unsaved title" } });
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  expect(confirm).toHaveBeenCalledWith("e2ee.unsaved");
  expect(onCancel).not.toHaveBeenCalled();
  act(() => mocks.session.lock());
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "e2ee.unlock: Saved title" })).toBeInTheDocument();
  expect(screen.queryByText("Unsaved title")).not.toBeInTheDocument();
  confirm.mockRestore();
});

it("preserves the draft across a conflict and explicitly adopts the reviewed revision", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const original = await encryptMemo(vault.key, vault.record.id, "original");
  const remote = await encryptMemo(vault.key, vault.record.id, "newer remote body", original.objectId);
  const memo = create(MemoSchema, { name: "memos/conflict", encryptedContent: encodeRecord(original) });
  const refreshed = create(MemoSchema, { ...memo, encryptedTitle: "remote title", encryptedContent: encodeRecord(remote) });
  mocks.update
    .mockRejectedValueOnce(new ConnectError("stale revision", Code.Aborted))
    .mockRejectedValueOnce(new ConnectError("changed again", Code.Aborted))
    .mockResolvedValue(refreshed);
  mocks.get.mockResolvedValue(refreshed);
  const view = render(<EncryptedMemoEditor memo={memo} editing />);
  const body = () => screen.getByRole("textbox", { name: "e2ee.title" });
  await waitFor(() => expect(body()).toHaveValue("original"));
  fireEvent.change(body(), { target: { value: "my draft" } });
  fireEvent.change(screen.getByRole("textbox", { name: "e2ee.memo-title" }), { target: { value: "my title" } });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await screen.findByText("e2ee.conflict");
  view.rerender(<EncryptedMemoEditor memo={refreshed} editing />);
  expect(body()).toHaveValue("my draft");
  expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
  expect(mocks.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "e2ee.conflict-review" }));
  await screen.findByText("newer remote body");
  expect(body()).toHaveValue("my draft");
  expect(screen.getByRole("textbox", { name: "e2ee.memo-title" })).toHaveValue("my title");
  fireEvent.click(screen.getByRole("button", { name: "e2ee.conflict-continue" }));
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(body()).toHaveValue("my draft");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
  const request = mocks.update.mock.calls[1][0];
  expect(request.expectedEncryptionRevision).toBe(remote.revisionId);
  expect(request.update.encryptedTitle).toBe("my title");
  expect(await decryptMemo(vault.key, decodeMemo(request.update.encryptedContent))).toBe("my draft");
  await screen.findByText("e2ee.conflict");
  expect(body()).toHaveValue("my draft");
  const newest = await encryptMemo(vault.key, vault.record.id, "changed during review", original.objectId);
  mocks.get.mockResolvedValue(create(MemoSchema, { ...refreshed, encryptedContent: encodeRecord(newest) }));
  fireEvent.click(screen.getByRole("button", { name: "e2ee.conflict-review" }));
  await screen.findByText("changed during review");
  fireEvent.click(screen.getByRole("button", { name: "e2ee.conflict-continue" }));
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(3));
  expect(mocks.update.mock.calls[2][0].expectedEncryptionRevision).toBe(newest.revisionId);
});

it("does not revive a conflict preview after locking during its fetch", async () => {
  const vault = await createVault("a separate strong encryption password");
  mocks.session.accept(mocks.session.ticket(), vault.key, vault.record.id);
  const envelope = await encryptMemo(vault.key, vault.record.id, "original");
  const memo = create(MemoSchema, { name: "memos/conflict", encryptedContent: encodeRecord(envelope) });
  mocks.update.mockRejectedValue(new ConnectError("stale revision", Code.Aborted));
  const pending = Promise.withResolvers<typeof memo>();
  mocks.get.mockReturnValue(pending.promise);
  render(<EncryptedMemoEditor memo={memo} editing />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "e2ee.title" })).toHaveValue("original"));
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await screen.findByText("e2ee.conflict");
  fireEvent.click(screen.getByRole("button", { name: "e2ee.conflict-review" }));
  act(() => mocks.session.lock());
  await act(async () => pending.resolve(memo));
  expect(screen.queryByText("original")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "e2ee.conflict-continue" })).not.toBeInTheDocument();
});
