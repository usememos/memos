import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoEditor from "@/components/MemoEditor";
import { transcriptionService } from "@/components/MemoEditor/services";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userGeneralSetting: {} }) }));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({
    aiSetting: { providers: [{ id: "configured", apiKeySet: true }], transcription: { providerId: "configured" } },
    fetchSetting: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
const clients = vi.hoisted(() => ({ getMemo: vi.fn(), updateMemo: vi.fn(), listMemoAttachments: vi.fn() }));
vi.mock("@/connect", () => ({ attachmentServiceClient: {}, memoServiceClient: clients, userServiceClient: {} }));
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("existing memo audio transcription", () => {
  it("blocks save while transcribing, inserts into the editable draft and retains the original attachment on save", async () => {
    const attachment = create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav", type: "audio/wav" });
    const memo = create(MemoSchema, {
      name: "memos/meeting",
      creator: "users/1",
      content: "Original meeting note",
      visibility: Visibility.PRIVATE,
      attachments: [attachment],
    });
    clients.getMemo.mockResolvedValue(memo);
    clients.updateMemo.mockImplementation(async ({ memo: update }) => create(MemoSchema, { ...memo, ...update }));
    const pending = Promise.withResolvers<string>();
    vi.spyOn(transcriptionService, "transcribeAttachment").mockReturnValue(pending.promise);
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoEditor memo={memo} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector(".cm-content")?.textContent).toBe(memo.content));
    fireEvent.click(screen.getByRole("button", { name: "Transcribe" }));
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    await act(async () => {
      pending.resolve("Recognized meeting discussion");
      await pending.promise;
    });
    await waitFor(() => expect(container.querySelector(".cm-content")?.textContent).toContain("Recognized meeting discussion"));
    expect(container.querySelector(".cm-content")?.textContent).toContain(memo.content);
    expect(screen.getByText("voice.wav")).toBeInTheDocument();
    expect(clients.updateMemo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(clients.updateMemo).toHaveBeenCalledOnce());
    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.memo.content).toContain("Recognized meeting discussion");
    expect(request.memo.content).toContain(memo.content);
    expect(request.updateMask.paths).not.toContain("attachments");
  });
});
