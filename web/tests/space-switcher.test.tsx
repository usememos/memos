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

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ generalSetting: {} }) }));
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
  useTranslate: () => (key: string) => key,
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

  it("names Home in the title and lists Home, Explore and every Space as one list of places", () => {
    renderAt();
    const trigger = screen.getByRole("button", { name: "space.switch: common.home" });
    expect(trigger).toHaveAttribute("title", "common.home");
    // The title's mark is a bare 20px glyph, like the wordmark's bird: no tile behind it.
    const glyph = trigger.querySelector("svg.lucide-house") as SVGElement;
    expect(glyph).toHaveClass("size-5");
    expect(glyph.parentElement?.className).not.toMatch(/\bbg-/);
    openSwitcher();
    const places = within(screen.getByRole("navigation", { name: "space.switch" }));
    expect(places.getAllByRole("link").map((link) => link.textContent)).toEqual(["common.home", "common.explore", "Product", "Research"]);
    expect(places.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");
    expect(places.getByRole("link", { name: "common.explore" })).not.toHaveAttribute("aria-current");
    expect(places.getByRole("link", { name: "Product" })).toHaveAttribute("href", "/spaces/product");
    expect(places.getByRole("link", { name: "Product" })).not.toHaveAttribute("aria-current");
    // Fixed labels carry no tooltip repeating them; a Space's name, which a row may cut off, does.
    expect(places.getByRole("link", { name: "common.home" })).not.toHaveAttribute("title");
    expect(places.getByRole("link", { name: "Product" })).toHaveAttribute("title", "Product");
    // The current row is filled and a hovered one is paler, with 2px between rows, so the two never fuse.
    expect(places.getByRole("link", { name: "common.home" })).toHaveClass("aria-[current=page]:bg-mu-hover", "hover:bg-mu-hover/65");
    expect(screen.getByRole("navigation", { name: "space.switch" })).toHaveClass("flex-col", "gap-0.5");
    // The Spaces are rows of the list itself: no picker to open, no "all spaces" entry.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "space.create" })).toHaveClass("mu-button-icon", "mu-s-xs");
  });

  it("walks the places with the arrow keys", () => {
    renderAt();
    openSwitcher();
    const places = screen.getByRole("navigation", { name: "space.switch" });
    const links = within(places).getAllByRole("link");
    links[0].focus();
    fireEvent.keyDown(links[0], { key: "ArrowDown" });
    expect(links[1]).toHaveFocus();
    fireEvent.keyDown(links[1], { key: "End" });
    expect(links[3]).toHaveFocus();
    fireEvent.keyDown(links[3], { key: "ArrowDown" });
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(links[0], { key: "ArrowUp" });
    expect(links[3]).toHaveFocus();
  });

  it("drops the Spaces heading when it would name nothing", () => {
    state.spaces = [];
    renderAt("/?creator=alice");
    openSwitcher();
    expect(screen.queryByText("space.spaces")).not.toBeInTheDocument();
  });

  it("holds places only: the account menu lives in the sidebar footer", () => {
    renderAt();
    openSwitcher();
    const panel = within(screen.getByRole("dialog"));
    for (const name of ["common.settings", "common.archived", "common.about", "common.inbox"]) {
      expect(panel.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(panel.queryByRole("button", { name: "common.sign-out" })).not.toBeInTheDocument();
  });

  it("goes to the chosen place and closes the list", async () => {
    const router = renderAt("/");
    openSwitcher();
    fireEvent.click(screen.getByRole("link", { name: "common.explore" }));
    expect(router.state.location.pathname).toBe("/explore");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "common.home" }));
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.search).toBe("");
    expect(state.setMobileOpen).not.toHaveBeenCalled();
  });

  it("changes place while preserving the view and other query parameters", () => {
    const router = renderAt("/calendar/2026/09?filter=tag%3Awork");
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "common.home" }));
    expect(router.state.location.pathname).toBe("/calendar/2026/09");
    expect(new URLSearchParams(router.state.location.search).get("creator")).toBe("steven");
    expect(new URLSearchParams(router.state.location.search).get("filter")).toBe("tag:work");

    openSwitcher();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "common.explore" }));
    expect(new URLSearchParams(router.state.location.search).get("creator")).toBeNull();
    expect(new URLSearchParams(router.state.location.search).get("filter")).toBe("tag:work");
  });

  it("enters a Space's timeline without the creator", async () => {
    const router = renderAt("/?creator=alice");
    openSwitcher();
    expect(screen.queryByRole("button", { name: "space.create" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Product" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/spaces/product"));
    expect(router.state.location.search).toBe("");
    expect(state.setMobileOpen).not.toHaveBeenCalled();
  });

  it.each([
    { path: "/spaces/product", home: "/", explore: "/explore" },
    { path: "/spaces/product/calendar/2026/09", home: "/calendar/2026/09?creator=steven", explore: "/calendar/2026/09" },
  ])("keeps Home and Explore inside a Space as the ways out of it: $path", ({ path, home, explore }) => {
    state.selectedSpaceName = "spaces/product";
    state.selectedSpace = state.spaces[0];
    renderAt(path);
    expect(screen.getByRole("button", { name: "space.switch: Product" })).toBeInTheDocument();
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("href", home);
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("href", explore);
    expect(screen.getByRole("link", { name: "common.home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "common.explore" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "space.create" })).toBeInTheDocument();
  });

  it("uses the selected author in the trigger and marks no place on another person's memos", () => {
    state.selectedSpaceName = "spaces/product";
    state.selectedSpace = state.spaces[0];
    renderAt("/spaces/product/map?creator=alice", "header");
    const trigger = screen.getByRole("button", { name: "space.switch: Alice / Product" });
    // With a Space selected, the creator shows as an avatar only; its name stays in the tooltip.
    expect(trigger).toHaveAttribute("title", "Alice / Product");
    expect(within(trigger).queryByText("Alice")).not.toBeInTheDocument();
    expect(within(trigger).getByText("Product")).toHaveClass("truncate");
    expect(trigger).toHaveClass("h-7", "gap-1", "px-[7px]");
    // The mark fills a row's 20px slot and the name follows 4px on, so the title starts on the rows' label rail.
    expect(within(trigger).getByText("Product").parentElement).toHaveClass("gap-1");
    expect(trigger.querySelector(".rounded-full")).toHaveClass("size-[18px]");
    expect(trigger.querySelector(".rounded-full")?.parentElement).toHaveClass("size-5");
    openSwitcher();
    const places = within(screen.getByRole("navigation", { name: "space.switch" }));
    for (const link of places.getAllByRole("link")) expect(link).not.toHaveAttribute("aria-current");
    expect(places.getByRole("link", { name: "common.home" })).toHaveAttribute("href", "/map?creator=steven");
    expect(screen.queryByRole("button", { name: "space.create" })).not.toBeInTheDocument();
  });

  it("lists a Space the user is viewing without being a member of", () => {
    state.selectedSpaceName = "spaces/guestbook";
    state.selectedSpace = { name: "spaces/guestbook", title: "Guestbook", description: "" };
    renderAt("/spaces/guestbook");
    openSwitcher();
    expect(screen.getByRole("link", { name: "Guestbook" })).toHaveAttribute("aria-current", "page");
  });

  it("treats an explicit current creator as Home", () => {
    renderAt("/calendar/2026/09?creator=steven");
    expect(screen.getByRole("button", { name: "space.switch: common.home" })).toBeInTheDocument();
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "space.create" })).toBeInTheDocument();
  });

  it.each(["/setting", "/inbox", "/memos/123"])("marks no place on a page outside the collections: %s", (path) => {
    renderAt(path);
    // No place to name there either, so the title stays the brand.
    expect(screen.getByRole("button", { name: "space.switch: common.memos" })).toBeInTheDocument();
    openSwitcher();
    expect(screen.getByRole("link", { name: "common.home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("href", "/explore");
    for (const link of within(screen.getByRole("navigation", { name: "space.switch" })).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("returns guests from a creator to Explore without showing private places", () => {
    state.currentUser = undefined;
    const router = renderAt("/?creator=alice");
    openSwitcher();
    const places = within(screen.getByRole("navigation", { name: "space.switch" }));
    expect(places.getAllByRole("link").map((link) => link.textContent)).toEqual(["common.explore"]);
    expect(screen.queryByText("space.spaces")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "space.create" })).not.toBeInTheDocument();
    fireEvent.click(places.getByRole("link", { name: "common.explore" }));
    expect(router.state.location.pathname).toBe("/explore");
    expect(router.state.location.search).toBe("");
  });

  it("names Explore in the title for a signed-in user, with its compass", () => {
    renderAt("/explore");
    const trigger = screen.getByRole("button", { name: "space.switch: common.explore" });
    expect(trigger).toHaveTextContent("common.explore");
    expect(trigger.querySelector("svg.lucide-compass")).toHaveClass("size-5");
  });

  it("gives guests on Explore their one place, under the instance's own name", () => {
    state.currentUser = undefined;
    renderAt("/explore");
    // A guest has nowhere else to be, so the title is the brand, not a place.
    expect(screen.getByRole("button", { name: "space.switch: common.memos" })).toBeInTheDocument();
    openSwitcher();
    const links = within(screen.getByRole("navigation", { name: "space.switch" })).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("keeps the popup aligned to the sidebar rail and opens Space creation", () => {
    renderAt();
    const trigger = screen.getByRole("button", { name: /space.switch:/ });
    const sidebar = trigger.closest("aside") as HTMLElement;
    vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({ left: 0, right: 223, width: 223 } as DOMRect);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ left: 12, right: 143, width: 131 } as DOMRect);
    openSwitcher();
    expect(document.querySelector(".mu-popover-popup")).toHaveStyle({ width: "199px" });
    fireEvent.click(screen.getByRole("button", { name: "space.create" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete create" }));
    expect(state.selectSpace).toHaveBeenCalledWith(state.spaces[0]);
  });

  it.each(["md", "header"] as const)("keeps the %s places popup fixed after positioning, with no scroll area of its own", async (size) => {
    renderAt("/", size);
    openSwitcher();
    const popup = await screen.findByRole("dialog");
    const positioner = popup.parentElement as HTMLElement;
    await waitFor(() => {
      expect(positioner.style.opacity).not.toBe("0");
      expect(positioner.style.position).toBe("fixed");
    });
    expect(popup.querySelector("[class*=overflow-y-auto]")).toBeNull();
  });
});
