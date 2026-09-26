import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpaceSwitcher from "@/components/AppSidebar/SpaceSwitcher";
import { getCollectionCreator, ROUTES, resolveCollectionRoute } from "@/router/routes";

const state = vi.hoisted(() => ({
  currentUser: { name: "users/steven", username: "steven", displayName: "Steven", avatarUrl: "" } as
    | { name: string; username: string; displayName: string; avatarUrl: string }
    | undefined,
  spaces: [
    { name: "spaces/product", title: "Product", description: "" },
    { name: "spaces/research", title: "Research", description: "" },
  ],
  selectedSpace: undefined as { name: string; title: string; description: string } | undefined,
  selectedSpaceName: undefined as string | undefined,
  selectSpace: vi.fn(),
  setMobileOpen: vi.fn(),
}));

vi.mock("@/components/MemosLogo", () => ({ default: () => <span>Memos</span> }));
vi.mock("@/components/UserMenu", () => ({
  default: () => <button type="button">Steven account</button>,
}));
vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.currentUser,
}));
vi.mock("@/hooks/useUserQueries", () => ({
  useUser: () => ({ data: { name: "users/alice", username: "alice", displayName: "Alice", avatarUrl: "" } }),
  useNotifications: () => ({ data: [] }),
}));
vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setMobileOpen: state.setMobileOpen }) }));
vi.mock("@/components/CreateSpaceDialog", () => ({
  default: ({ open, onCreated }: { open: boolean; onCreated?: (space: (typeof state.spaces)[number]) => void }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => onCreated?.(state.spaces[0])}>
          Complete create
        </button>
      </div>
    ) : null,
}));
vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => {
    const location = useLocation();
    const route = resolveCollectionRoute(location.pathname);
    return {
      ...state,
      creatorUsername:
        route.pathname === ROUTES.EXPLORE
          ? undefined
          : (getCollectionCreator(location.search) ?? (route.pathname === ROUTES.HOME ? state.currentUser?.username : undefined)),
      duplicateSpaceTitles: new Set<string>(),
      isLoadingSpaces: false,
      isSpacesError: false,
    };
  },
}));
vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string, options?: { source: string }) => (options?.source ? `Back to ${options.source}` : key),
}));

const renderAt = (path = "/", size: "md" | "header" = "md") => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <aside>
            <SpaceSwitcher size={size} />
          </aside>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const openSwitcher = () => fireEvent.click(screen.getByRole("button", { name: /space.switch:/ }));

describe("SpaceSwitcher", () => {
  beforeEach(() => {
    state.currentUser = { name: "users/steven", username: "steven", displayName: "Steven", avatarUrl: "" };
    state.spaces = [
      { name: "spaces/product", title: "Product", description: "" },
      { name: "spaces/research", title: "Research", description: "" },
    ];
    state.selectedSpace = undefined;
    state.selectedSpaceName = undefined;
    state.selectSpace.mockClear();
    state.setMobileOpen.mockClear();
  });

  it("shows an independent creator choice, a collapsed Space selector, and an icon create action", () => {
    renderAt();
    openSwitcher();
    const userButton = screen.getByRole("link", { name: "common.home" });
    const exploreButton = screen.getByRole("link", { name: "common.explore" });
    expect(screen.getByRole("navigation", { name: "common.browse" })).toBeInTheDocument();
    expect(exploreButton).not.toHaveAttribute("aria-current");
    expect(userButton).toHaveAttribute("aria-current", "page");
    expect(userButton.compareDocumentPosition(exploreButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "space.switch" })).toHaveTextContent("space.all-spaces");
    expect(screen.queryByText("Product")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "space.create" })).toHaveAttribute("title", "space.create");
    expect(screen.getByRole("button", { name: "Steven account" })).toBeInTheDocument();
  });

  it("switches Home to Explore without closing the menu", () => {
    const router = renderAt("/");
    openSwitcher();
    fireEvent.click(screen.getByRole("link", { name: "common.explore" }));
    expect(router.state.location.pathname).toBe("/explore");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "common.home" }));
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("changes creator while preserving the Space and other query parameters", () => {
    state.selectedSpaceName = "spaces/product";
    state.selectedSpace = state.spaces[0];
    const router = renderAt("/spaces/product/calendar/2026/09?filter=tag%3Awork");
    openSwitcher();
    fireEvent.click(screen.getByRole("link", { name: "common.home" }));
    expect(router.state.location.pathname).toBe("/spaces/product/calendar/2026/09");
    expect(new URLSearchParams(router.state.location.search).get("creator")).toBe("steven");
    expect(new URLSearchParams(router.state.location.search).get("filter")).toBe("tag:work");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("link", { name: "common.explore" }));
    expect(new URLSearchParams(router.state.location.search).get("creator")).toBeNull();
    expect(new URLSearchParams(router.state.location.search).get("filter")).toBe("tag:work");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Space choices on demand and preserves creator when choosing one", async () => {
    const router = renderAt("/?creator=alice");
    openSwitcher();
    expect(screen.queryByRole("button", { name: "space.create" })).not.toBeInTheDocument();
    expect(screen.queryByText("Product")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "space.switch" }));
    const product = await screen.findByRole("option", { name: "Product" });
    fireEvent.pointerDown(product, { pointerType: "mouse" });
    fireEvent.click(product, { pointerType: "mouse" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/spaces/product"));
    expect(new URLSearchParams(router.state.location.search).get("creator")).toBe("alice");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(state.setMobileOpen).not.toHaveBeenCalled();
  });

  it("uses the selected author in the user slot and trigger", () => {
    state.selectedSpaceName = "spaces/product";
    state.selectedSpace = state.spaces[0];
    renderAt("/spaces/product?creator=alice", "header");
    const trigger = screen.getByRole("button", { name: "space.switch: Alice / Product" });
    expect(within(trigger).getByText("Alice / Product")).toHaveClass("truncate");
    expect(trigger).toHaveClass("h-9", "gap-2", "px-2");
    openSwitcher();
    expect(screen.queryByRole("navigation", { name: "common.browse" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to common.home" })).toHaveAttribute("href", "/spaces/product");
  });

  it("returns from another creator to the selected Space Home without closing the menu", () => {
    state.selectedSpaceName = "spaces/product";
    state.selectedSpace = state.spaces[0];
    const router = renderAt("/spaces/product/map?creator=alice");
    openSwitcher();
    fireEvent.click(screen.getByRole("link", { name: "Back to common.home" }));
    expect(router.state.location.pathname).toBe("/spaces/product");
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "space.create" })).toBeInTheDocument();
    expect(state.setMobileOpen).not.toHaveBeenCalled();
  });

  it("treats an explicit current creator as Home", () => {
    renderAt("/calendar/2026/09?creator=steven");
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: /Back to/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "space.create" })).toBeInTheDocument();
  });

  it("returns guests from a creator to Explore without showing private actions", () => {
    state.currentUser = undefined;
    const router = renderAt("/?creator=alice");
    openSwitcher();
    expect(screen.getByRole("link", { name: "Back to common.explore" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "space.create" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Back to common.explore" }));
    expect(router.state.location.pathname).toBe("/explore");
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "common.browse" })).not.toBeInTheDocument();
  });

  it("keeps the popup aligned to the sidebar rail and opens Space creation", () => {
    renderAt();
    const trigger = screen.getByRole("button", { name: /space.switch:/ });
    const sidebar = trigger.closest("aside") as HTMLElement;
    vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({ left: 0, right: 223, width: 223 } as DOMRect);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ left: 12, right: 143, width: 131 } as DOMRect);
    openSwitcher();
    expect(document.querySelector('[data-slot="popover-content"]')).toHaveStyle({ width: "199px" });
    fireEvent.click(screen.getByRole("button", { name: "space.create" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete create" }));
    expect(state.selectSpace).toHaveBeenCalledWith(state.spaces[0]);
  });

  it("gives guests on Explore only the account panel, with no single-choice Browse control", () => {
    state.currentUser = undefined;
    renderAt("/explore");
    openSwitcher();
    expect(screen.queryByRole("navigation", { name: "common.browse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Steven account" })).toBeInTheDocument();
  });
});
