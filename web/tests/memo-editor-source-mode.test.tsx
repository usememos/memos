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

afterEach(() => {
  localStorage.clear();
  cacheService.clearAll();
});

describe("MemoEditor source mode", () => {
  it("switches from the ＋ menu, names itself in the editor's corner while on, and switches back from there", () => {
    const { container } = mount();
    expect(sourceText(container)).toBeNull();
    expect(screen.queryByRole("button", { name: "editor.source" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.source-mode" }));

    expect(sourceText(container)).not.toBeNull();
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify("source"));
    // The tag belongs to the writing area, not the toolbar, and the first line leaves room for it.
    const tag = screen.getByRole("button", { name: "editor.source" });
    expect(tag.parentElement?.querySelector(":scope > .memo-editor-content")).not.toBeNull();
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-source-mode");

    fireEvent.click(screen.getByRole("button", { name: "editor.source" }));

    expect(sourceText(container)).toBeNull();
    expect(screen.queryByRole("button", { name: "editor.source" })).not.toBeInTheDocument();
    expect(localStorage.getItem(MODE_KEY)).toBe(JSON.stringify("rich"));
  });

  it("opens in the mode remembered on this device", () => {
    localStorage.setItem(MODE_KEY, JSON.stringify("source"));
    const { container } = mount();

    expect(sourceText(container)).not.toBeNull();
    expect(screen.getByRole("button", { name: "editor.source" })).toBeInTheDocument();
  });

  it.each([
    ["rich", true],
    ["source", false],
  ])("offers the checklist suggestion in %s mode: %s", async (mode, offered) => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode));
    cacheService.saveNow(cacheService.key("users/1", draftKeyFor({ kind: "new", scope: CACHE_KEY })), {
      content: "Groceries",
      attachments: [],
    });
    mount([
      { id: "tag:food", source: "view", kind: "tag", tag: "food" },
      { id: "checklist", source: "view", kind: "checklist" },
    ]);

    // The tag chip works in both modes, so the bar renders either way and only the checklist chip differs.
    await waitFor(() => expect(screen.getByRole("button", { name: "common.add #food" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "editor.format.task-list" }) !== null).toBe(offered);
  });
});
