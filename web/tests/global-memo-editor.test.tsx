import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { GlobalMemoEditorProvider, useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";

const DIALOG = { name: "editor.new-memo" };

const mocks = vi.hoisted(() => ({
  currentUser: { name: "users/test" } as { name: string } | undefined,
  isUserSettingsInitialized: true,
  editorProps: undefined as MemoEditorProps | undefined,
  loadMemoEditor: vi.fn(),
  setMobileOpen: vi.fn(),
  setQuickFindOpen: vi.fn(),
  selectedSpaceName: undefined as string | undefined,
  pathname: "/",
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({ pathname: mocks.pathname }),
}));

vi.mock("@/components/MemoEditor/loader", () => ({
  loadMemoEditor: mocks.loadMemoEditor,
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  useAppSidebar: () => ({ setMobileOpen: mocks.setMobileOpen, setQuickFindOpen: mocks.setQuickFindOpen }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: mocks.isUserSettingsInitialized }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectedSpaceName: mocks.selectedSpaceName }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => mocks.currentUser,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const MockMemoEditor = (props: MemoEditorProps) => {
  mocks.editorProps = props;
  return (
    <div data-testid="global-editor">
      <button type="button" onClick={() => props.onConfirm?.("memos/created")}>
        Save memo
      </button>
      <button type="button" onClick={props.onCancel}>
        Cancel editor
      </button>
      <button type="button" onClick={props.onFocusModeExit}>
        Exit focus mode
      </button>
      <button type="button" onClick={() => props.onSavingChange?.(true)}>
        Start saving
      </button>
    </div>
  );
};

const Trigger = () => {
  const { openEditor } = useGlobalMemoEditor();
  return (
    <button type="button" onClick={openEditor}>
      Open editor
    </button>
  );
};

/** Stands in for the mobile drawer: its Compose button unmounts as the drawer closes. */
const EphemeralTrigger = () => {
  const { openEditor } = useGlobalMemoEditor();
  const [dismissed, setDismissed] = useState(false);
  return (
    <>
      {!dismissed && (
        <button
          type="button"
          data-new-memo-trigger
          onClick={() => {
            setDismissed(true);
            openEditor();
          }}
        >
          Open drawer editor
        </button>
      )}
      <button type="button" data-mobile-navigation-trigger>
        Open navigation
      </button>
    </>
  );
};

const renderProvider = (children = <Trigger />) => render(<GlobalMemoEditorProvider>{children}</GlobalMemoEditorProvider>);

/** Renders, focuses the trigger so focus-return has something to restore, and opens. */
const openViaTrigger = async () => {
  renderProvider();
  const trigger = screen.getByRole("button", { name: "Open editor" });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole("dialog", DIALOG);
  return trigger;
};

const expectClosed = () => waitFor(() => expect(screen.queryByRole("dialog", DIALOG)).not.toBeInTheDocument());

describe("GlobalMemoEditorProvider", () => {
  beforeEach(() => {
    mocks.currentUser = { name: "users/test" };
    mocks.isUserSettingsInitialized = true;
    mocks.editorProps = undefined;
    mocks.loadMemoEditor.mockResolvedValue({ default: MockMemoEditor });
    mocks.setMobileOpen.mockClear();
    mocks.setQuickFindOpen.mockClear();
    mocks.selectedSpaceName = undefined;
    mocks.pathname = "/";
  });

  it("opens a modal focus-mode editor, closes the sidebar surfaces, and restores focus after Escape", async () => {
    const trigger = await openViaTrigger();
    const dialog = screen.getByRole("dialog", DIALOG);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.setQuickFindOpen).toHaveBeenCalledWith(false);
    // `onFocusModeExit` is the hosted marker: the editor mounts in focus mode and
    // exits by dismissing this dialog rather than collapsing inline.
    expect(mocks.editorProps).toMatchObject({
      autoFocus: true,
      cacheKey: "global-memo-editor",
      onFocusModeExit: expect.any(Function),
    });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement | null));

    fireEvent.keyDown(dialog, { key: "Escape" });

    await expectClosed();
    expect(trigger).toHaveFocus();
  });

  it.each(["Save memo", "Cancel editor", "Exit focus mode", "common.close"])("closes after %s", async (action) => {
    const trigger = await openViaTrigger();

    fireEvent.click(screen.getByRole("button", { name: action }));

    await expectClosed();
    expect(trigger).toHaveFocus();
  });

  it("prevents dialog and focus-mode dismissal while saving but lets save completion force close", async () => {
    await openViaTrigger();
    const dialog = screen.getByRole("dialog", DIALOG);

    fireEvent.click(screen.getByRole("button", { name: "Start saving" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }));
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save memo" }));
    await expectClosed();
  });

  it("makes the screen-reader close control visible when keyboard-focused", async () => {
    await openViaTrigger();
    const close = screen.getByRole("button", { name: "common.close" });

    expect(close).toHaveClass("sr-only", "focus-visible:not-sr-only");
    close.focus();
    expect(close).toHaveFocus();
  });

  it("returns focus to mobile navigation when the drawer's Compose trigger unmounts", async () => {
    renderProvider(<EphemeralTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Open drawer editor" }));
    await screen.findByRole("dialog", DIALOG);
    fireEvent.click(screen.getByRole("button", { name: "Cancel editor" }));

    await expectClosed();
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
  });

  it("does not open or load the editor for a guest", () => {
    mocks.currentUser = undefined;
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(mocks.loadMemoEditor).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("invalidates a pending open request across sign-out and same-user sign-in", async () => {
    let resolveEditorLoad!: (module: { default: typeof MockMemoEditor }) => void;
    mocks.loadMemoEditor.mockReturnValue(
      new Promise((resolve) => {
        resolveEditorLoad = resolve;
      }),
    );
    const view = renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    expect(mocks.loadMemoEditor).toHaveBeenCalledOnce();

    mocks.currentUser = undefined;
    view.rerender(
      <GlobalMemoEditorProvider>
        <Trigger />
      </GlobalMemoEditorProvider>,
    );
    mocks.currentUser = { name: "users/test" };
    view.rerender(
      <GlobalMemoEditorProvider>
        <Trigger />
      </GlobalMemoEditorProvider>,
    );

    await act(async () => {
      resolveEditorLoad({ default: MockMemoEditor });
    });

    expect(screen.queryByRole("dialog", DIALOG)).not.toBeInTheDocument();
  });

  it("does not resurrect an open composer after the same user signs out and back in", async () => {
    const view = renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    await screen.findByRole("dialog", DIALOG);

    mocks.currentUser = undefined;
    view.rerender(
      <GlobalMemoEditorProvider>
        <Trigger />
      </GlobalMemoEditorProvider>,
    );
    await expectClosed();

    mocks.currentUser = { name: "users/test" };
    view.rerender(
      <GlobalMemoEditorProvider>
        <Trigger />
      </GlobalMemoEditorProvider>,
    );

    expect(screen.queryByRole("dialog", DIALOG)).not.toBeInTheDocument();
  });

  it("does not assign a global Compose shortcut", () => {
    renderProvider(<span />);

    fireEvent.keyDown(window, { key: "m", shiftKey: true, metaKey: true });

    expect(mocks.loadMemoEditor).not.toHaveBeenCalled();
  });

  it("snapshots the selected Space when opening the composer", async () => {
    mocks.selectedSpaceName = "spaces/product";
    await openViaTrigger();

    expect(mocks.editorProps).toMatchObject({
      cacheKey: "global-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });

    mocks.selectedSpaceName = "spaces/other";
    expect(mocks.editorProps).toMatchObject({
      cacheKey: "global-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });
  });

  it.each(["/explore", "/attachments"])("inherits the remembered Space when composing from %s", async (pathname) => {
    mocks.pathname = pathname;
    mocks.selectedSpaceName = "spaces/product";
    await openViaTrigger();

    expect(mocks.editorProps).toMatchObject({
      cacheKey: "global-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });
  });

  it.each([
    "/u/steven",
    "/archived",
    "/inbox",
    "/setting",
    "/views",
    "/about",
    "/memos/abc",
    "/memos/shares/token",
    "/403",
    "/404",
    "/unknown",
  ])("creates an unassigned memo from %s even when a Space is remembered", async (pathname) => {
    mocks.pathname = pathname;
    mocks.selectedSpaceName = "spaces/product";
    await openViaTrigger();

    expect(mocks.editorProps).toMatchObject({
      cacheKey: "global-memo-editor",
      defaultSpace: undefined,
    });
  });
});
