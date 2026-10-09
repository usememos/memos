import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuickFindDialog, { quickFindShortcutLabel } from "@/components/AppSidebar/QuickFindDialog";
import { AppSidebarProvider } from "@/contexts/AppSidebarContext";
import { SpaceProvider } from "@/contexts/SpaceContext";

const state = vi.hoisted(() => ({
  currentUser: { name: "users/alice" } as { name: string } | undefined,
  spaces: [{ name: "spaces/product", title: "Product", description: "" }],
  filters: [] as Array<{ factor: "contentSearch" | "celSearch" | "tagSearch"; value: string }>,
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/MemoFilterContext")>();
  return {
    ...actual,
    useMemoFilterContext: () => ({
      filters: state.filters,
      memoView: undefined,
      setFilters: vi.fn(),
      setMemoView: vi.fn(),
      removeFilter: vi.fn(),
    }),
  };
});

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.currentUser,
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({ data: state.spaces, isSuccess: true, isPending: false, isError: false }),
  useSpace: (_user: string, name: string) => ({
    data: state.spaces.find((space) => space.name === name),
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useMemoViews: () => ({ data: [] }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const renderQuickFind = () => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <SpaceProvider>
            <AppSidebarProvider>
              <QuickFindDialog />
            </AppSidebarProvider>
          </SpaceProvider>
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
};

/**
 * A browser fires keydown on the focused element and it bubbles to the window listener, so
 * dispatching anywhere inside `document.body` exercises the path a real keystroke takes.
 */
const pressShortcut = (init: KeyboardEventInit = {}, target: Document | Element | Node | Window = document.body) => {
  const event = createEvent.keyDown(target, { key: "k", ...init });
  fireEvent(target, event);
  return event;
};

/** Matches by accessible name so a test fixture with `role="dialog"` cannot satisfy the query. */
const findQuickFindDialog = () => screen.queryByRole("dialog", { name: "common.search" });

describe("Quick Find shortcut", () => {
  beforeEach(() => {
    state.filters = [];
  });

  it.each([
    ["Ctrl+K", { key: "k", ctrlKey: true }],
    ["Cmd+K", { key: "k", metaKey: true }],
    ["Ctrl+K with caps lock", { key: "K", ctrlKey: true }],
  ])("opens Quick Find with %s and suppresses the browser default", async (_name, init) => {
    renderQuickFind();
    expect(findQuickFindDialog()).not.toBeInTheDocument();

    const event = pressShortcut(init);

    expect(event.defaultPrevented).toBe(true);
    await screen.findByRole("dialog", { name: "common.search" });
  });

  it.each([
    ["unmodified k", { key: "k" }],
    ["Ctrl+Shift+K", { key: "k", ctrlKey: true, shiftKey: true }],
    ["Ctrl+Alt+K", { key: "k", ctrlKey: true, altKey: true }],
    ["Ctrl+P, the browser print dialog", { key: "p", ctrlKey: true }],
  ])("ignores %s", (_name, init) => {
    renderQuickFind();

    const event = pressShortcut(init);

    expect(event.defaultPrevented).toBe(false);
    expect(findQuickFindDialog()).not.toBeInTheDocument();
  });

  it("ignores auto-repeated presses so holding the shortcut cannot flicker the dialog", () => {
    renderQuickFind();

    pressShortcut({ ctrlKey: true, repeat: true });

    expect(findQuickFindDialog()).not.toBeInTheDocument();
  });

  it("defers to a handler that already consumed the chord, e.g. the editor's Ctrl+K", () => {
    renderQuickFind();

    const event = createEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    event.preventDefault();
    fireEvent(document.body, event);

    expect(findQuickFindDialog()).not.toBeInTheDocument();
  });

  it("does not open over another dialog but still closes itself with the shortcut", async () => {
    renderQuickFind();

    // Base UI dialogs carry an explicit role attribute, which is what the guard looks for.
    const otherDialog = document.createElement("div");
    otherDialog.setAttribute("role", "dialog");
    otherDialog.setAttribute("aria-label", "Another dialog");
    document.body.append(otherDialog);

    try {
      pressShortcut({ ctrlKey: true });
      expect(findQuickFindDialog()).not.toBeInTheDocument();

      otherDialog.remove();
      pressShortcut({ ctrlKey: true });
      await screen.findByRole("dialog", { name: "common.search" });

      document.body.append(otherDialog);
      pressShortcut({ ctrlKey: true });
      await waitFor(() => expect(findQuickFindDialog()).not.toBeInTheDocument());
    } finally {
      otherDialog.remove();
    }
  });

  it("closes an open Quick Find when the shortcut is typed into its own search field", async () => {
    renderQuickFind();
    pressShortcut({ ctrlKey: true });
    const field = await screen.findByRole("textbox");

    pressShortcut({ ctrlKey: true }, field);

    await waitFor(() => expect(findQuickFindDialog()).not.toBeInTheDocument());
  });
});

describe("Quick Find shortcut hint", () => {
  const originalPlatform = navigator.platform;

  afterEach(() => {
    Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true });
  });

  // The hint is the only place the user learns the chord, so it has to name the modifier
  // their keyboard actually has.
  it.each([
    ["MacIntel", "⌘K"],
    ["Win32", "Ctrl+K"],
  ])("names the chord for %s as %s", (platform, expected) => {
    Object.defineProperty(navigator, "platform", { value: platform, configurable: true });

    expect(quickFindShortcutLabel()).toBe(expected);
  });
});
