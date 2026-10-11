import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoSave } from "@/components/MemoEditor/hooks/useMemoSave";
import { memoService } from "@/components/MemoEditor/services/memoService";
import type { EditorState } from "@/components/MemoEditor/state";
import { createInitialState } from "@/components/MemoEditor/state/types";
import type { LocalFile } from "@/components/MemoEditor/types/attachment";
import { type Attachment, AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const mocks = vi.hoisted(() => ({
  createMemo: vi.fn(),
  uploadAttachment: vi.fn(),
  save: vi.fn(),
  state: undefined as unknown as EditorState,
}));

vi.mock("@/connect", () => ({
  memoServiceClient: { createMemo: mocks.createMemo },
  attachmentServiceClient: { uploadAttachment: mocks.uploadAttachment },
}));

vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

// The hook test drives a small stand-in for the editor reducer, so that what
// the hook dispatches after a failure is what the next save reads.
vi.mock("@/components/MemoEditor/state", () => ({
  useEditorContext: () => ({
    actions: {
      reset: () => ({ type: "reset" }),
      setLoading: () => ({ type: "noop" }),
      setJustSaved: () => ({ type: "noop" }),
      setMetadata: (metadata: Partial<EditorState["metadata"]>) => ({ type: "set-metadata", metadata }),
      setLocalFiles: (localFiles: LocalFile[]) => ({ type: "set-local-files", localFiles }),
      setTimestamps: () => ({ type: "noop" }),
    },
    dispatch: (action: { type: string; metadata?: Partial<EditorState["metadata"]>; localFiles?: LocalFile[] }) => {
      if (action.type === "set-metadata") mocks.state = { ...mocks.state, metadata: { ...mocks.state.metadata, ...action.metadata } };
      if (action.type === "set-local-files") mocks.state = { ...mocks.state, localFiles: action.localFiles ?? [] };
    },
    getState: () => mocks.state,
  }),
}));

const localFile = (name: string): LocalFile => ({ file: new File(["data"], name, { type: "text/plain" }), previewUrl: `blob:${name}` });

const editorState = (localFiles: LocalFile[], attachments: Attachment[] = []): EditorState => {
  const state = createInitialState();
  return { ...state, content: "hello", localFiles, metadata: { ...state.metadata, attachments } };
};

const uploadedAttachment = (name: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename: name });

describe("memoService.save", () => {
  beforeEach(() => {
    mocks.createMemo.mockReset();
    mocks.uploadAttachment.mockReset();
    mocks.uploadAttachment.mockImplementation(async (request: { upload: { case: string }; finishWrite?: boolean }) =>
      request.upload.case === "spec"
        ? { uploadId: "u1", committedSize: 0n, maxChunkSize: 1024 }
        : { committedSize: 4n, attachment: uploadedAttachment("a.txt") },
    );
  });

  it("reports each upload before the memo create can fail", async () => {
    mocks.createMemo.mockRejectedValue(new Error("quota exceeded"));
    const file = localFile("a.txt");
    const onFileUploaded = vi.fn();

    await expect(memoService.save(editorState([file]), { onFileUploaded })).rejects.toThrow("quota exceeded");

    expect(onFileUploaded).toHaveBeenCalledOnce();
    expect(onFileUploaded).toHaveBeenCalledWith(file, expect.objectContaining({ name: "attachments/a.txt" }));
  });
});

describe("useMemoSave after a failed save", () => {
  beforeEach(() => {
    mocks.save.mockReset();
    vi.spyOn(memoService, "save").mockImplementation(mocks.save);
  });

  it("keeps uploaded files on the draft so a retry does not upload them again", async () => {
    const uploaded = localFile("a.txt");
    const pending = localFile("b.txt");
    const attachment = uploadedAttachment("a.txt");
    mocks.state = editorState([uploaded, pending]);
    // The first save uploads one file, then the memo create is refused.
    mocks.save.mockImplementationOnce(async (_state, options) => {
      options.onFileUploaded(uploaded, attachment);
      throw new Error("quota exceeded");
    });
    mocks.save.mockResolvedValueOnce({ hasChanges: true, memoName: "memos/new" });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useMemoSave({ discardDraft: vi.fn() }), { wrapper });

    await act(async () => result.current());

    expect(mocks.state.metadata.attachments).toEqual([attachment]);
    expect(mocks.state.localFiles).toEqual([pending]);

    await act(async () => result.current());

    const retried = mocks.save.mock.calls[1][0] as EditorState;
    expect(retried.localFiles).toEqual([pending]);
    expect(retried.metadata.attachments).toEqual([attachment]);
  });

  it("leaves the draft alone when nothing uploaded", async () => {
    const file = localFile("a.txt");
    mocks.state = editorState([file]);
    mocks.save.mockRejectedValueOnce(new Error("offline"));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useMemoSave({ discardDraft: vi.fn() }), { wrapper });

    await act(async () => result.current());

    expect(mocks.state.localFiles).toEqual([file]);
    expect(mocks.state.metadata.attachments).toEqual([]);
  });
});
