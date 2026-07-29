import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalMemoEditorProvider, useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";

vi.mock("@/components/MemoEditor/loader", () => ({
  loadMemoEditor: vi.fn(async () => ({
    default: ({ initialFocusMode, onFocusModeExit }: { initialFocusMode?: boolean; onFocusModeExit?: () => void }) => (
      <div data-testid="global-editor" data-focus-mode={initialFocusMode}>
        <button type="button" onClick={onFocusModeExit}>
          Exit focus mode
        </button>
      </div>
    ),
  })),
}));

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

function Trigger() {
  const { openEditor } = useGlobalMemoEditor();
  return (
    <button type="button" onClick={openEditor}>
      Open editor
    </button>
  );
}

describe("GlobalMemoEditorProvider", () => {
  it("opens the shared editor in focus mode and closes when focus mode exits", async () => {
    render(
      <GlobalMemoEditorProvider>
        <Trigger />
      </GlobalMemoEditorProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    const editor = await screen.findByTestId("global-editor");
    expect(editor).toHaveAttribute("data-focus-mode", "true");

    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }));
    expect(screen.queryByTestId("global-editor")).not.toBeInTheDocument();
  });
});
