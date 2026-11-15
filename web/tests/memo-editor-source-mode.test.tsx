import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoEditor, preloadMemoEditing } from "@/components/MemoEditor";
import { draftKeyFor } from "@/components/MemoEditor/edit/draftKey";
import { cacheService } from "@/components/MemoEditor/edit/services";
import { memoKeys } from "@/hooks/useMemoQueries";
import type { MemoSuggestion } from "@/lib/memo-suggestions";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
// The account's EDITOR setting, shared by every useAuth caller the way AuthContext shares it.
const editorSetting = vi.hoisted(() => {
  let value: { sourceMode: boolean; autoFocusMode?: boolean } | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: { sourceMode: boolean; autoFocusMode?: boolean } | undefined | ((current: typeof value) => typeof value)) => {
      value = typeof next === "function" ? next(value) : next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
const settingsReady = vi.hoisted(() => {
  let ready = true;
  const listeners = new Set<() => void>();
  return {
    get: () => ready,
    set: (value: boolean) => {
      ready = value;
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
      isUserSettingsInitialized: useSyncExternalStore(settingsReady.subscribe, settingsReady.get),
      setUserEditorSetting: editorSetting.set,
    }),
  };
});
vi.mock("@/lib/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() }, showErrorToast: vi.fn() }));
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
  settingsReady.set(true);
  editorSetting.set(undefined);
  updateEditorSetting.mockReset();
  cacheService.clearAll();
});

const toggleSourceMode = () => {
  fireEvent.click(screen.getByRole("button", { name: "common.add" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "editor.markdown-mode" }));
};

describe("automatic focus mode", () => {
  it.each([false, true])("waits for settings and respects manual toggling (%s)", async (manualToggle) => {
    settingsReady.set(false);
    const memo = create(MemoSchema, { name: "memos/existing", creator: "users/1", content: "Existing memo" });
    const client = new QueryClient();
    client.setQueryData(memoKeys.detail(memo.name), memo);
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoEditor mode="edit" name={memo.name} />
      </QueryClientProvider>,
    );
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    if (manualToggle) {
      fireEvent.click(screen.getByRole("button", { name: "common.add" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "editor.focus-mode" }));
      fireEvent.click(screen.getByRole("button", { name: "editor.exit-focus-mode" }));
    }
    act(() => {
      editorSetting.set({ sourceMode: false, autoFocusMode: true });
      settingsReady.set(true);
    });
    await waitFor(() => {
      if (manualToggle) expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
      else expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode");
    });
  });
  it.each([false, true])("does not expand on focus or click (preference %s)", (autoFocusMode) => {
    editorSetting.set({ sourceMode: false, autoFocusMode });
    const { container } = mount();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    expect(editor).not.toBeNull();
    fireEvent.focus(editor);
    fireEvent.click(editor);
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
  });

  it.each([false, true])("enters on text insertion only when enabled (%s)", async (autoFocusMode) => {
    editorSetting.set({ sourceMode: false, autoFocusMode });
    const { container } = mount();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    editor.focus();
    fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "a" }));
    await waitFor(() => expect(editor).toHaveTextContent("a"));
    if (autoFocusMode) {
      await waitFor(() => expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode"));
      fireEvent.click(screen.getByRole("button", { name: "editor.exit-focus-mode" }));
      fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "b" }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    } else {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    }
  });

  it("hides temporary collapse when automatic focus mode is disabled", () => {
    editorSetting.set({ sourceMode: false, autoFocusMode: false });
    const { container } = mount();
    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "editor.focus-mode" }));
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode");
    expect(screen.queryByRole("button", { name: "editor.temporarily-collapse-focus-mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editor.exit-focus-mode" })).toBeInTheDocument();
  });

  it.each([
    ["backdrop", "typing"],
    ["backdrop", "paste"],
    ["temporary button", "typing"],
    ["temporary button", "paste"],
  ])("reopens a new draft after %s and %s", async (dismissal, input) => {
    editorSetting.set({ sourceMode: false, autoFocusMode: true });
    const { container } = mount();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "a" }));
    await waitFor(() => expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode"));

    fireEvent.click(
      dismissal === "backdrop"
        ? screen.getByLabelText("editor.exit-focus-mode", { selector: "div" })
        : screen.getByRole("button", { name: "editor.temporarily-collapse-focus-mode" }),
    );
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    fireEvent.focus(editor);
    fireEvent.click(editor);
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    if (input === "paste") {
      fireEvent.paste(editor, { clipboardData: { getData: () => "pasted", files: [], items: [], types: ["text/plain"] } });
    } else {
      fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "b" }));
    }
    await waitFor(() => expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode"));
  });

  it.each(["backdrop", "temporary button", "button"])("respects %s dismissal while editing an existing memo", async (dismissal) => {
    editorSetting.set({ sourceMode: false, autoFocusMode: true });
    const memo = create(MemoSchema, { name: "memos/existing", creator: "users/1", content: "Existing memo" });
    const client = new QueryClient();
    client.setQueryData(memoKeys.detail(memo.name), memo);
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 180,
      width: 480,
      top: 0,
      left: 0,
      right: 480,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoEditor mode="edit" name={memo.name} />
      </QueryClientProvider>,
    );
    rectSpy.mockRestore();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode");
    expect(container.querySelector('[aria-hidden="true"]')).toHaveStyle({ height: "180px" });
    const dismissButton =
      dismissal === "backdrop"
        ? screen.getByLabelText("editor.exit-focus-mode", { selector: "div" })
        : screen.getByRole("button", {
            name: dismissal === "button" ? "editor.exit-focus-mode" : "editor.temporarily-collapse-focus-mode",
          });
    fireEvent.click(dismissButton);
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    expect(editor.contains(document.activeElement)).toBe(true);
    fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "a" }));
    if (dismissal !== "button") {
      await waitFor(() => expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode"));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    }
  });

  it("keeps the editor focused when leaving focus mode from the insert menu", async () => {
    editorSetting.set({ sourceMode: false, autoFocusMode: false });
    const { container } = mount();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "editor.focus-mode" }));
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode");

    fireEvent.click(screen.getByRole("button", { name: "common.add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "editor.focus-mode" }));
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    await waitFor(() => expect(editor.contains(document.activeElement)).toBe(true));
  });

  it("does not offer temporary collapse in a host-owned dialog", () => {
    editorSetting.set({ sourceMode: false, autoFocusMode: true });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoEditor draft={{ scope: "hosted" }} onFocusModeExit={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "editor.temporarily-collapse-focus-mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.close" })).toBeInTheDocument();
  });

  it("waits until input method composition is committed", async () => {
    editorSetting.set({ sourceMode: false, autoFocusMode: true });
    const { container } = mount();
    const editor = container.querySelector(".memo-editor-root") as HTMLElement;
    fireEvent.compositionStart(editor);
    fireEvent(editor, new InputEvent("beforeinput", { bubbles: true, inputType: "insertCompositionText", data: "ni", isComposing: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.querySelector(".memo-editor-content")).not.toHaveAttribute("data-focus-mode");
    fireEvent.compositionEnd(editor, { data: "你" });
    await waitFor(() => expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-focus-mode"));
  });
});

describe("MemoEditor source mode", () => {
  it("shows the Markdown label only while source mode is on", () => {
    const { container } = mount();
    expect(sourceText(container)).toBeNull();
    expect(screen.queryByText("Markdown", { exact: true })).not.toBeInTheDocument();

    toggleSourceMode();

    expect(sourceText(container)).not.toBeNull();
    expect(updateEditorSetting).toHaveBeenLastCalledWith(
      expect.objectContaining({ editorSetting: expect.objectContaining({ sourceMode: true }), updateMask: ["source_mode"] }),
      expect.anything(),
    );
    expect(screen.getByText("Markdown", { exact: true })).toHaveAttribute("aria-label", "editor.markdown-mode");
    expect(container.querySelector(".memo-editor-content")).toHaveAttribute("data-source-mode");

    toggleSourceMode();

    expect(sourceText(container)).toBeNull();
    expect(screen.queryByText("Markdown", { exact: true })).not.toBeInTheDocument();
    expect(updateEditorSetting).toHaveBeenLastCalledWith(
      expect.objectContaining({ editorSetting: expect.objectContaining({ sourceMode: false }), updateMask: ["source_mode"] }),
      expect.anything(),
    );
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
