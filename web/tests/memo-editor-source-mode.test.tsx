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
// The account's EDITOR setting, shared by every useAuth caller the way AuthContext shares it.
const editorSetting = vi.hoisted(() => {
  let value: { sourceMode: boolean } | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: { sourceMode: boolean } | undefined) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
const updateEditorSetting = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: {} }),
  useUsersByUsernames: () => ({ data: undefined }),
  useUpdateUserEditorSetting: () => ({ mutate: updateEditorSetting }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuth: () => ({
      userGeneralSetting: {},
      userEditorSetting: useSyncExternalStore(editorSetting.subscribe, editorSetting.get),
      setUserEditorSetting: editorSetting.set,
    }),
  };
});
vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
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
  editorSetting.set(undefined);
  updateEditorSetting.mockReset();
  cacheService.clearAll();
});

const toggleSourceMode = () => {
  fireEvent.click(screen.getByRole("button", { name: "common.add" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" }));
};

describe("MemoEditor source mode", () => {
  it("shows the Markdown label only while source mode is on", () => {
    const { container } = mount();
    expect(sourceText(container)).toBeNull();
    expect(screen.queryByText("Markdown", { exact: true })).not.toBeInTheDocument();

    toggleSourceMode();

    expect(sourceText(container)).not.toBeNull();
    expect(updateEditorSetting).toHaveBeenLastCalledWith(expect.objectContaining({ sourceMode: true }), expect.anything());
    expect(screen.getByText("Markdown", { exact: true })).toHaveAttribute("aria-label", "editor.markdown-mode");
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-source-mode");

    toggleSourceMode();

    expect(sourceText(container)).toBeNull();
    expect(screen.queryByText("Markdown", { exact: true })).not.toBeInTheDocument();
    expect(updateEditorSetting).toHaveBeenLastCalledWith(expect.objectContaining({ sourceMode: false }), expect.anything());
  });

  it("switches back when saving the mode fails", () => {
    updateEditorSetting.mockImplementation((_setting, options) => options.onError(new Error("unavailable")));
    const { container } = mount();

    toggleSourceMode();

    expect(sourceText(container)).toBeNull();
    expect(screen.queryByText("Markdown", { exact: true })).not.toBeInTheDocument();
  });

  it("opens in the mode saved on the account", () => {
    editorSetting.set({ sourceMode: true });
    const { container } = mount();

    expect(sourceText(container)).not.toBeNull();
    expect(screen.getByText("Markdown", { exact: true })).toBeInTheDocument();
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

    toggleSourceMode();
    expect(sourceLines(container)).toBe(markdown);

    toggleSourceMode();
    expect(sourceText(container)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan");

    // Rich mode shows no Markdown string, so the source text after a third switch is the round trip's result.
    toggleSourceMode();
    expect(sourceLines(container)).toBe(markdown);
  });

  it.each(["rich", "source"])("offers the checklist suggestion in %s mode and applies it there", async (mode) => {
    editorSetting.set({ sourceMode: mode === "source" });
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
