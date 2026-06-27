import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EditorProvider, useEditorSelector } from "@/components/MemoEditor/state";
import InsertMenu from "@/components/MemoEditor/Toolbar/InsertMenu";

// useTranslate returns the i18n key directly (no i18next backend in tests).
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
// The link/location dialogs drag in maps + heavy deps; they're closed here.
vi.mock("@/components/MemoMetadata", () => ({ LinkMemoDialog: () => null, LocationDialog: () => null }));
// useLinkMemo → useCurrentUser → useAuth would need an AuthProvider; stub the user.
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));

// Radix DropdownMenu reaches for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function ModeProbe() {
  const editorMode = useEditorSelector((s) => s.ui.editorMode);
  return <span data-testid="mode">{editorMode}</span>;
}

function renderInsertMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EditorProvider>
        <InsertMenu onLocationChange={() => {}} />
        <ModeProbe />
      </EditorProvider>
    </QueryClientProvider>,
  );
}

// Opens the "+" dropdown, then its "More" submenu, and returns the
// "WYSIWYG Editor" checkbox item.
function openWysiwygCheckbox() {
  // Open the dropdown (keyboard open is the most reliable path in jsdom).
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  // Open the "More" submenu (controlled open state toggles on trigger click).
  fireEvent.click(screen.getByText("common.more"));
  return screen.getByText("editor.wysiwyg-editor");
}

describe("InsertMenu editor-mode toggle", () => {
  it("unchecking the WYSIWYG item switches to raw and persists the preference", () => {
    localStorage.clear();
    renderInsertMenu();
    expect(screen.getByTestId("mode").textContent).toBe("wysiwyg");

    fireEvent.click(openWysiwygCheckbox());

    expect(screen.getByTestId("mode").textContent).toBe("raw");
    expect(localStorage.getItem("memos-editor-mode")).toBe("raw");
  });

  it("checking the WYSIWYG item switches back to rich text from raw mode", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderInsertMenu();
    expect(screen.getByTestId("mode").textContent).toBe("raw");

    fireEvent.click(openWysiwygCheckbox());

    expect(screen.getByTestId("mode").textContent).toBe("wysiwyg");
    expect(localStorage.getItem("memos-editor-mode")).toBe("wysiwyg");
  });
});
