import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoInit } from "@/components/MemoEditor/hooks";
import { EditorProvider, useEditorSelector } from "@/components/MemoEditor/state";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({
  default: Object.assign(toastMock, { error: vi.fn(), success: vi.fn() }),
  toast: Object.assign(toastMock, { error: vi.fn(), success: vi.fn() }),
}));

const isLosslessMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/MemoEditor/Editor/markdownCodec", () => ({
  isLosslessRoundTrip: isLosslessMock,
}));

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

function Harness({ content }: { content: string }) {
  const memo = create(MemoSchema, { name: "memos/1", content });
  useMemoInit({ editorRef: { current: null }, memo, username: "users/test" });
  const editorMode = useEditorSelector((s) => s.ui.editorMode);
  return <span data-testid="mode">{editorMode}</span>;
}

function renderGuard(content: string) {
  render(
    <EditorProvider>
      <Harness content={content} />
    </EditorProvider>,
  );
}

describe("memo-open load guard", () => {
  it("switches the session to raw mode when the round trip would lose content", () => {
    localStorage.clear();
    isLosslessMock.mockReturnValue(false);
    renderGuard("some exotic content");
    expect(screen.getByTestId("mode").textContent).toBe("raw");
    expect(toastMock).toHaveBeenCalled();
    expect(isLosslessMock).toHaveBeenCalledWith("some exotic content");
    // Session-only: the persisted preference is untouched.
    expect(localStorage.getItem("memos-editor-mode")).toBeNull();
  });

  it("stays in wysiwyg when the round trip is lossless", () => {
    localStorage.clear();
    isLosslessMock.mockReturnValue(true);
    renderGuard("plain content");
    expect(screen.getByTestId("mode").textContent).toBe("wysiwyg");
  });

  it("skips the round-trip check when the user already prefers raw mode", () => {
    localStorage.clear();
    localStorage.setItem("memos-editor-mode", "raw");
    isLosslessMock.mockReturnValue(false);
    renderGuard("exotic content");
    expect(isLosslessMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});
