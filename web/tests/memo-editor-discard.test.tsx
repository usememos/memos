import { create } from "@bufbuild/protobuf";
import { EditorView } from "@codemirror/view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoEditor from "@/components/MemoEditor";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userGeneralSetting: {} }) }));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ aiSetting: { providers: [] }, fetchSetting: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
const clients = vi.hoisted(() => ({ getMemo: vi.fn() }));
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

describe("MemoEditor Escape discard", () => {
  it("keeps a dirty edit until explicit confirmation and restores editor focus when dismissed", async () => {
    const memo = create(MemoSchema, {
      name: "memos/edit",
      creator: "users/1",
      content: "Original note",
      visibility: Visibility.PRIVATE,
    });
    const cancel = vi.fn();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoEditor memo={memo} onCancel={cancel} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector(".cm-content")?.textContent).toBe(memo.content));
    const content = container.querySelector<HTMLElement>(".cm-content")!;
    const view = EditorView.findFromDOM(content)!;
    act(() => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "Unsaved edit" } });
      view.focus();
    });
    fireEvent.keyDown(content, { key: "Escape", keyCode: 27 });
    const dialog = await screen.findByRole("dialog", { name: "Discard changes?" });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(content).toHaveFocus());
    expect(view.state.doc.toString()).toBe("Unsaved edit");

    fireEvent.keyDown(content, { key: "Escape", keyCode: 27 });
    const reopened = await screen.findByRole("dialog", { name: "Discard changes?" });
    await waitFor(() => expect(reopened).toHaveFocus());
    fireEvent.keyDown(reopened, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  });
});
