import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoEditor, preloadMemoEditing } from "@/components/MemoEditor";
import { draftKeyFor } from "@/components/MemoEditor/edit/draftKey";
import { cacheService } from "@/components/MemoEditor/edit/services";
import type { MemoSuggestion } from "@/lib/memo-suggestions";

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }), useUsersByUsernames: () => ({ data: undefined }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userGeneralSetting: {} }) }));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ aiSetting: { providers: [], transcription: undefined }, fetchSetting: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => ({ data: [] }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: undefined }) }));
vi.mock("@/connect", () => ({ attachmentServiceClient: {}, memoServiceClient: {}, userServiceClient: {} }));
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeAll(async () => {
  // The editing session loads lazily; loaded once, it renders without suspending.
  await preloadMemoEditing();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const MODE_KEY = "memos-editor-mode";
const CACHE_KEY = "source-mode-test";

const mount = (suggestions?: readonly MemoSuggestion[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoEditor draft={{ scope: CACHE_KEY }} suggestions={suggestions} />
    </QueryClientProvider>,
  );

const sourceText = (container: HTMLElement) => container.querySelector(".mbe-source");
/** The Markdown source mode shows: one element per line, the line endings between them. */
const sourceLines = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".mbe-source .mbe-source-line"), (line) => line.textContent).join("\n");

afterEach(() => {
  localStorage.clear();
  cacheService.clearAll();
});

describe("MemoEditor source mode", () => {
  it("switches from the ＋ menu and back, and nothing in the editor names the mode", () => {
    const { container } = mount();
    expect(sourceText(container)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" }));

    expect(sourceText(container)).not.toBeNull();
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify("source"));
    // The text shows the mode; the composer adds no tag or indicator for it.
    expect(screen.queryByRole("button", { name: "editor.source" })).not.toBeInTheDocument();
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-source-mode");

    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" }));

    expect(sourceText(container)).toBeNull();
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify("rich"));
  });

  it("opens in the mode remembered on this device", () => {
    localStorage.setItem(MODE_KEY, JSON.stringify("source"));
    const { container } = mount();

    expect(sourceText(container)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches without changing the text", () => {
    const markdown = "# Plan\n\n- [ ] Ship **it**";
    cacheService.saveNow(cacheService.key("users/1", draftKeyFor({ kind: "new", scope: CACHE_KEY })), {
      content: markdown,
      attachments: [],
    });
    const { container } = mount();
    const toggle = () => {
      fireEvent.click(screen.getByRole("button", { name: "common.add" }));
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" }));
    };

    toggle();
    expect(sourceLines(container)).toBe(markdown);

    toggle();
    expect(sourceText(container)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan");

    // Rich mode shows no Markdown string, so the source text after a third switch is the round trip's result.
    toggle();
    expect(sourceLines(container)).toBe(markdown);
  });

  it.each(["rich", "source"])("offers the checklist suggestion in %s mode and applies it there", async (mode) => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode));
    cacheService.saveNow(cacheService.key("users/1", draftKeyFor({ kind: "new", scope: CACHE_KEY })), {
      content: "Groceries",
      attachments: [],
    });
    const { container } = mount([
      { id: "tag:food", source: "view", kind: "tag", tag: "food" },
      { id: "checklist", source: "view", kind: "checklist" },
    ]);

    await waitFor(() => expect(screen.getByRole("button", { name: "common.add #food" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "editor.format.task-list" }));

    // In source mode the chip is a text edit; in rich mode it changes the block. Both save the same Markdown.
    await waitFor(() => expect(screen.queryByRole("button", { name: "editor.format.task-list" })).not.toBeInTheDocument());
    if (mode === "source") expect(sourceLines(container)).toBe("- [ ] Groceries");
    else expect(container.querySelector(".memo-editor-root input[type=checkbox]")).not.toBeNull();
  });
});
