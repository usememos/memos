import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, render as testingLibraryRender, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar, { MobileAppHeader, MobileAppSidebar } from "@/components/AppSidebar";
import { type MemoFilter } from "@/contexts/MemoFilterContext";
import { getCollectionCreator, resolveCollectionRoute } from "@/router/routes";

const authState = vi.hoisted(() => ({
  currentUser: { name: "users/test" } as { name: string; username?: string } | undefined,
  memoViews: [] as Array<{ name: string; title: string }>,
  notifications: [] as Array<{ status: number }>,
  guestCreator: undefined as { username: string; displayName: string; avatarUrl: string } | undefined,
}));
const sidebarState = vi.hoisted(() => ({
  mobileOpen: false,
  setMobileOpen: vi.fn(),
  setQuickFindOpen: vi.fn(),
}));
const globalEditorState = vi.hoisted(() => ({
  canOpen: true,
  openEditor: vi.fn(),
}));
const spaceState = vi.hoisted(() => ({
  spaces: [] as Array<{ name: string; title: string; description: string }>,
  selectedSpace: undefined as { name: string; title: string; description: string } | undefined,
  selectSpace: vi.fn(),
}));
const filteredStatsHook = vi.hoisted(() => vi.fn());
const filterState = vi.hoisted(() => ({ filters: [] as MemoFilter[] }));
const tagsSectionHook = vi.hoisted(() => vi.fn());

vi.mock("@/components/MemosLogo", () => ({
  default: ({ size }: { size?: string }) => <span data-logo-size={size}>Memos logo</span>,
}));

vi.mock("@/components/MemoDisplaySettingMenu", () => ({
  default: () => <button type="button">memo.view-options</button>,
}));

vi.mock("@/components/UserMenu", () => ({
  default: () => (
    <button type="button" className="w-full">
      User menu
    </button>
  ),
}));

vi.mock("@/components/CreateSpaceDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/StatisticsView", () => ({
  default: () => <div>Calendar</div>,
}));

vi.mock("@/components/AppSidebar/TagsSection", () => ({
  default: (props: unknown) => {
    tagsSectionHook(props);
    return <div>Tags</div>;
  },
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  useAppSidebar: () => ({
    attachmentSection: "all",
    setAttachmentSection: vi.fn(),
    inboxFilter: "all",
    setInboxFilter: vi.fn(),
    memoDetail: undefined,
    setMemoDetail: vi.fn(),
    mobileOpen: sidebarState.mobileOpen,
    setMobileOpen: sidebarState.setMobileOpen,
    quickFindOpen: false,
    setQuickFindOpen: sidebarState.setQuickFindOpen,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => globalEditorState,
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/contexts/MemoFilterContext")>()),
  useMemoFilterContext: () => ({
    filters: filterState.filters,
    memoView: undefined,
    setMemoView: vi.fn(),
  }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => {
    const location = useLocation();
    const { spaceName, isCollection } = resolveCollectionRoute(location.pathname);
    const duplicateSpaceTitles = new Set(
      spaceState.spaces
        .filter((space, index) => spaceState.spaces.findIndex((candidate) => candidate.title === space.title) !== index)
        .map((space) => space.title),
    );
    return {
      ...spaceState,
      selectedSpaceName: spaceName,
      creatorUsername: isCollection ? getCollectionCreator(location.search) : undefined,
      selectedSpace: spaceName ? spaceState.selectedSpace : undefined,
      memoFilter: spaceName ? `space == ${JSON.stringify(spaceName)}` : undefined,
      duplicateSpaceTitles,
      isLoadingSpaces: false,
      isSpacesError: false,
    };
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => authState.currentUser,
}));

vi.mock("@/hooks/useMemoFilters", () => ({
  useCommentScopeFilter: () => "parent == null",
}));

vi.mock("@/hooks/useFilteredMemoStats", () => ({
  useFilteredMemoStats: (options: unknown) => {
    filteredStatsHook(options);
    return { statistics: { activityStats: {}, timeBasis: "create_time" }, tags: {} };
  },
}));

vi.mock("@/hooks/useAttachmentLibrary", () => ({
  useAttachmentLibraryStats: () => ({ stats: { media: 0, documents: 0, audio: 0, unused: 0 } }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  default: () => true,
}));

vi.mock("@/hooks/useUserQueries", () => ({
  userKeys: {
    memoViews: (parent?: string) => ["users", "memoViews", parent],
  },
  useMemoViews: () => ({ data: authState.memoViews }),
  useNotifications: () => ({ data: authState.notifications }),
  useUser: () => ({ data: authState.guestCreator }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const render = (ui: Parameters<typeof testingLibraryRender>[0]) =>
  testingLibraryRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>,
  );

const expectCollapsedNavPill = (pill: HTMLElement, label: string) => {
  expect(pill).toHaveClass("mu-s-md", "h-(--mu-row-height)", "rounded-(--mu-row-radius)", "px-[5px]");
  expect(pill.firstElementChild).toHaveClass("size-4");
  const labelTrack = pill.querySelector('span.grid[aria-hidden="true"]');
  expect(labelTrack).toHaveClass("grid-cols-[0fr]", "ps-0");
  expect(labelTrack).not.toHaveClass("@min-[240px]:grid-cols-[1fr]");
  expect(labelTrack).toHaveTextContent(label);
};

const expectExpandedNavPill = (pill: HTMLElement, label: string) => {
  expect(pill).toHaveClass("mu-s-md", "h-(--mu-row-height)", "rounded-(--mu-row-radius)", "px-[5px]");
  expect(pill.firstElementChild).toHaveClass("size-4");
  const labelTrack = pill.querySelector("span.grid");
  // The label opens only where the row can afford it; the control's aria-label names it regardless.
  expect(labelTrack).toHaveClass("@min-[240px]:grid-cols-[1fr]", "@min-[240px]:ps-1.5");
  expect(labelTrack).toHaveAttribute("aria-hidden", "true");
  expect(pill.querySelector("[data-sidebar-label]")).toHaveTextContent(label);
};

const expectActiveNavPill = (pill: HTMLElement, label: string) => {
  expectExpandedNavPill(pill, label);
  expect(pill).toHaveAttribute("aria-current", "page");
};

const expectDefaultNavPill = (pill: HTMLElement, label: string) => {
  expectExpandedNavPill(pill, label);
  expect(pill).not.toHaveAttribute("aria-current");
};

describe("App sidebar logo", () => {
  beforeEach(() => {
    authState.currentUser = { name: "users/test" };
    authState.memoViews = [];
    authState.notifications = [];
    authState.guestCreator = undefined;
    sidebarState.mobileOpen = false;
    sidebarState.setMobileOpen.mockClear();
    sidebarState.setQuickFindOpen.mockClear();
    globalEditorState.canOpen = true;
    globalEditorState.openEditor.mockClear();
    spaceState.spaces = [];
    spaceState.selectedSpace = undefined;
    spaceState.selectSpace.mockClear();
    filteredStatsHook.mockClear();
    filterState.filters = [];
    tagsSectionHook.mockClear();
  });

  it("preserves creator and filters, excluding map state, when moving between collection pages", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/product/map?creator=alice&filter=tagSearch%3Awork&lat=31&lng=121&zoom=12&memo=memos/a"]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const search = "?filter=tagSearch%3Awork&creator=alice";
    expect(screen.getByRole("link", { name: "common.timeline" })).toHaveAttribute("href", `/spaces/product${search}`);
    expect(screen.getByRole("link", { name: "common.calendar" })).toHaveAttribute("href", `/spaces/product/calendar${search}`);
    expect(screen.getByRole("link", { name: "common.attachments" })).toHaveAttribute("href", `/spaces/product/attachments${search}`);
  });

  it("shows the context switcher and opens the global memo editor", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    // Signed in with no creator chosen, every collection view is Explore, and the title says so.
    const switcher = screen.getByRole("button", { name: "space.switch: common.explore" });
    const header = switcher.closest("[data-sidebar-header]");
    const compose = screen.getByRole("button", { name: "editor.new-memo" });
    const primaryNavigation = screen.getByRole("navigation", { name: "common.primary-navigation" });
    const search = within(primaryNavigation).getByRole("button", { name: "common.search" });

    expect(header).toHaveClass("h-13", "px-3");
    expect(switcher).toHaveTextContent("common.explore");
    expect(within(switcher).queryByText("Memos logo")).not.toBeInTheDocument();
    expect(switcher.querySelector(".lucide-compass")).toHaveClass("size-5");
    expect(switcher).toHaveClass("min-w-0", "h-7", "gap-1", "px-[7px]");
    expect(switcher).not.toHaveClass("px-1");
    expect(switcher.firstElementChild).not.toHaveClass("flex-1");
    expect(switcher.querySelector(".lucide-chevrons-up-down")).not.toBeNull();
    expect(switcher.querySelector(".lucide-chevron-down")).toBeNull();
    expect(compose).toHaveClass("mu-button", "mu-button-neutral", "mu-button-icon", "mu-s-md");
    expect(compose).not.toHaveClass("rounded-full");
    expect(header).not.toContainElement(search);
    expect(search).toHaveClass("ms-auto", "h-(--mu-row-height)", "px-[5px]");
    expect(search.querySelector(".lucide-search")).toHaveClass("mu-icon");

    fireEvent.click(search);
    expect(sidebarState.setQuickFindOpen).toHaveBeenCalledWith(true);
    expect(sidebarState.setMobileOpen).toHaveBeenCalledWith(false);

    fireEvent.click(compose);
    expect(globalEditorState.openEditor).toHaveBeenCalledOnce();
    // The Calendar destination is a nav pill; the statistics calendar stays off this route.
    expect(within(primaryNavigation).getByRole("link", { name: "common.calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it.each(["/spaces/product", "/spaces/product/", "/spaces/product/attachments", "/spaces/product/Attachments/"])(
    "shows the selected Space only on collection route %s",
    (path) => {
      const product = { name: "spaces/product", title: "Product", description: "" };
      spaceState.spaces = [product];
      spaceState.selectedSpace = product;

      render(
        <MemoryRouter initialEntries={[path]}>
          <AppSidebar />
        </MemoryRouter>,
      );

      expect(screen.getByRole("button", { name: "space.switch: Product" })).toBeInTheDocument();
    },
  );

  it.each(["/archived", "/inbox", "/setting", "/about", "/views", "/memos/123", "/memos/shares/token", "/404"])(
    "shows Memos in the switcher on global page %s",
    (path) => {
      const product = { name: "spaces/product", title: "Product", description: "" };
      spaceState.spaces = [product];
      spaceState.selectedSpace = product;

      render(
        <MemoryRouter initialEntries={[path]}>
          <AppSidebar />
        </MemoryRouter>,
      );

      const brand = screen.getByRole("button", { name: "space.switch: common.memos" });
      expect(brand).toHaveClass("h-7", "gap-1", "px-[7px]");
      expect(within(brand).getByText("Memos logo")).toHaveAttribute("data-logo-size", "header");
    },
  );

  it("scopes collection statistics to the selected Space", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/product"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(
      expect.objectContaining({ context: "collection", filter: '(space == "spaces/product") && (parent == null)' }),
    );
  });

  it("includes authorized Space memos in All Explore statistics", () => {
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "collection", filter: "(parent == null)" }));
  });

  it("keeps Archived statistics and tag UI state unscoped by Space", () => {
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "archived", filter: "(parent == null)" }));
    expect(tagsSectionHook).toHaveBeenCalledWith(expect.objectContaining({ scope: "archived" }));
  });

  it("keeps the signed-in account in a one-row footer that opens its menu", () => {
    authState.currentUser = { name: "users/test", username: "test", displayName: "Tess" } as typeof authState.currentUser;
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Tess")).toBeInTheDocument();
    const row = footer.getByText("Tess").parentElement as HTMLElement;
    expect(row).toHaveClass(
      "h-(--mu-row-height)",
      "rounded-(--mu-row-radius)",
      "px-2",
      "pe-[3px]",
      "mu-label-sm",
      "text-mu-text-secondary",
    );
    expect(row.querySelector(".rounded-full")).toHaveClass("size-[18px]");
    // Nothing unread: the row carries no Inbox mark.
    expect(footer.queryByRole("link")).not.toBeInTheDocument();
    // The title's list holds places only.
    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));
    expect(screen.queryByRole("button", { name: "User menu" })).not.toBeInTheDocument();
    fireEvent.click(footer.getByRole("button", { name: "setting.sso.account: Tess" }));
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
  });

  it("marks the account row with the unread Inbox count only while something is unread", () => {
    authState.notifications = [{ status: 1 }, { status: 1 }, { status: 2 }];
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const inbox = within(screen.getByRole("contentinfo")).getByRole("link", { name: "common.inbox, 2 inbox.unread" });
    expect(inbox).toHaveAttribute("href", "/inbox");
    // It draws 20px tall but takes the footer's 44px, and hovering it clears the row's own fill.
    expect(inbox).toHaveClass("after:-top-[9px]", "after:-bottom-[17px]", "hover:bg-mu-hover");
    expect(inbox.parentElement).toHaveClass("has-[[data-row-control]:hover]:bg-transparent");
    expect(inbox).toHaveTextContent("2");
    // A link of its own beside the row's trigger, never nested inside it.
    expect(inbox.closest("button")).toBeNull();
    fireEvent.click(inbox);
    expect(sidebarState.setMobileOpen).toHaveBeenCalledWith(false);
  });

  it("keeps the account row as the scroller's sticky foot and softens the list under it, with no line", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const footer = screen.getByRole("contentinfo");
    const scroller = document.querySelector("[data-sidebar-scroller]") as HTMLElement;
    // Inside the scroller, so its scrollbar stays above the row and a wheel on the row scrolls the list.
    expect(footer.parentElement).toBe(scroller);
    expect(scroller).toHaveClass("overflow-y-auto", "flex-col", "scroll-pb-16");
    expect(footer).toHaveClass("sticky", "bottom-0", "opaque:border-t");
    expect(footer.className).not.toMatch(/(^| )border-t/);
    // The last row stops clear of the row's soft edge.
    expect(footer.previousElementSibling).toHaveClass("grow", "pb-5");
    const veil = footer.querySelector("[data-sidebar-veil]") as HTMLElement;
    expect(veil).toHaveClass("pointer-events-none", "absolute", "bottom-0", "backdrop-blur-[5px]", "opaque:hidden");
    expect(veil).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps Attachments active after route normalization", () => {
    render(
      <MemoryRouter initialEntries={["/Attachments/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.attachments" })).toHaveAttribute("aria-current", "page");
  });

  it("hides the instance-level unused attachment collection in a Space", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/product/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "attachment-library.labels.unused" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "attachment-library.tabs.media" })).toBeInTheDocument();
  });

  it("hides Compose when the composer reports it is not available", () => {
    globalEditorState.canOpen = false;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.search" })).toBeInTheDocument();
  });

  it("shows the compact public navigation for a guest", () => {
    authState.currentUser = undefined;
    globalEditorState.canOpen = false;
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "space.switch: common.memos" })).toHaveTextContent("Memos logo");
    const primaryNavigation = screen.getByRole("navigation", { name: "common.primary-navigation" });
    expect(primaryNavigation).toHaveClass("h-(--mu-row-height)", "items-center", "gap-1", "px-3");
    expect(primaryNavigation).not.toHaveClass("flex-col");
    const navigation = within(primaryNavigation);
    expect(navigation.getByRole("button", { name: "common.search" })).toHaveClass("ms-auto", "h-(--mu-row-height)", "px-[5px]");
    expectActiveNavPill(navigation.getByRole("link", { name: "common.timeline" }), "common.timeline");
    const calendar = navigation.getByRole("link", { name: "common.calendar" });
    expect(calendar).toHaveAttribute("href", "/calendar");
    expectCollapsedNavPill(calendar, "common.calendar");
    const map = navigation.getByRole("link", { name: "common.map" });
    expect(map).toHaveAttribute("href", "/map");
    expectCollapsedNavPill(map, "common.map");
    expect(navigation.queryByRole("link", { name: "common.about" })).not.toBeInTheDocument();
    expect(navigation.queryByRole("link", { name: "common.attachments" })).not.toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: "common.sign-in-to-memos" });
    const footer = within(signIn.closest("footer") as HTMLElement);
    expect(signIn).toHaveAttribute("href", "/auth");
    // The guest's row is the user's row with nobody in it: same box, a blank avatar, the label where the name goes.
    const row = signIn.parentElement as HTMLElement;
    expect(row).toHaveClass(
      "h-(--mu-row-height)",
      "rounded-(--mu-row-radius)",
      "px-2",
      "pe-[3px]",
      "mu-label-sm",
      "text-mu-text-secondary",
    );
    expect(footer.getByText("common.sign-in-to-memos")).toHaveAttribute("data-sidebar-label");
    expect(row.querySelector(".rounded-full")).toHaveClass("size-[18px]", "bg-mu-well");
    // Guests keep preferences and About behind the row's ⋯, a control of its own beside the sign-in link.
    const more = footer.getByRole("button", { name: "common.more" });
    expect(more.closest("a")).toBeNull();
    expect(more).toHaveClass("size-5", "after:-top-[9px]", "after:-bottom-[17px]", "after:-end-[17px]");
    // The visible label is decoration: the link under the row carries the words once.
    expect(footer.getByText("common.sign-in-to-memos")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
  });

  it("shows the selected creator in the guest sidebar and mobile header", () => {
    authState.currentUser = undefined;
    authState.guestCreator = { username: "steven", displayName: "Steven", avatarUrl: "/avatar.png" };

    render(
      <MemoryRouter initialEntries={["/?creator=steven"]}>
        <AppSidebar />
        <MobileAppHeader />
      </MemoryRouter>,
    );

    const creatorLinks = screen.getAllByRole("button", { name: "space.switch: Steven" });
    expect(creatorLinks).toHaveLength(2);
    for (const link of creatorLinks) {
      expect(link.querySelector("img")).toHaveAttribute("src", "/avatar.png");
    }
    expect(screen.queryByRole("link", { name: "Memos logo" })).not.toBeInTheDocument();
  });

  it("shows the selected username while the guest profile is loading", () => {
    authState.currentUser = undefined;

    render(
      <MemoryRouter initialEntries={["/?creator=steven"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "space.switch: steven" })).toHaveTextContent("steven");
  });

  it.each(["/403", "/404", "/unknown"])("uses the common sidebar without inheriting collection content on %s", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "common.about" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "common.resources", level: 2 })).toBeInTheDocument();
    const documentationLink = screen.getByRole("link", { name: "about.documents" });
    expect(documentationLink).toHaveAttribute("href", "https://usememos.com/docs");
    expect(documentationLink).toHaveAttribute("target", "_blank");
    expect(documentationLink).toHaveAttribute("rel", "noreferrer");
    fireEvent.click(documentationLink);
    expect(sidebarState.setMobileOpen).toHaveBeenCalledWith(false);
    expect(screen.getByRole("link", { name: "about.api-docs" })).toHaveAttribute("href", "https://usememos.com/docs/api");
    expect(screen.getByRole("link", { name: "about.github-repository" })).toHaveAttribute("href", "https://github.com/usememos/memos");
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "common.statistics" })).not.toBeInTheDocument();
    expect(screen.queryByText("common.views")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "space.switch: common.memos" })).toBeInTheDocument();
    const navigation = within(screen.getByRole("navigation", { name: "common.primary-navigation" }));
    expectDefaultNavPill(navigation.getByRole("link", { name: "common.timeline" }), "common.timeline");
    const attachments = navigation.getByRole("link", { name: "common.attachments" });
    expect(attachments).toHaveAttribute("href", "/attachments");
    expectCollapsedNavPill(attachments, "common.attachments");
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
  });

  it.each(["/about", "/About/"])("marks the common About link active on %s", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "common.resources", level: 2 })).toBeInTheDocument();

    const navigation = within(screen.getByRole("navigation", { name: "common.primary-navigation" }));
    const scopeTrigger = navigation.getByRole("link", { name: "common.timeline" });
    expectDefaultNavPill(scopeTrigger, "common.timeline");
    expect(scopeTrigger.querySelector(".lucide-chevron-down")).not.toBeInTheDocument();
    expectCollapsedNavPill(navigation.getByRole("link", { name: "common.attachments" }), "common.attachments");
  });

  it("uses a visitor sidebar for a guest on a route without contextual content", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = within(screen.getByRole("navigation", { name: "common.primary-navigation" }));
    const home = navigation.getByRole("link", { name: "common.timeline" });
    expect(home).toHaveAttribute("href", "/explore");
    expectDefaultNavPill(home, "common.timeline");
    expect(screen.queryByRole("link", { name: "common.attachments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
    expect(navigation.queryByRole("link", { name: "common.about" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
  });

  it.each([
    ["/calendar/2026/09", "common.calendar"],
    ["/map", "common.map"],
  ])("marks the reading view active for a guest on %s", (path, label) => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = within(screen.getByRole("navigation", { name: "common.primary-navigation" }));
    expectCollapsedNavPill(navigation.getByRole("link", { name: "common.timeline" }), "common.timeline");
    expectActiveNavPill(navigation.getByRole("link", { name: label }), label);
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it("uses a compact scope menu and places views below the calendar", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const calendar = screen.getByText("Calendar");
    const views = screen.getByText("common.views");
    expect(screen.getByRole("region", { name: "common.statistics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "common.views", level: 2 })).toBeInTheDocument();
    expect(calendar.compareDocumentPosition(views) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const viewOptions = screen.getByRole("button", { name: "memo.view-options" });
    const createView = screen.getByRole("button", { name: "setting.memo-view.create" });
    expect(viewOptions.closest("nav")).toBe(screen.getByRole("navigation", { name: "common.primary-navigation" }));
    expect(screen.getByRole("link", { name: "common.timeline" }).nextElementSibling).toBe(viewOptions);
    expect(viewOptions.parentElement).toHaveClass("bg-mu-hover", "rounded-mu-md");
    expect(viewOptions.closest("a")).toBeNull();
    expect(createView).toHaveTextContent("setting.memo-view.create");
    expect(screen.queryByRole("button", { name: "common.tasks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.explore" })).not.toBeInTheDocument();

    const home = screen.getByRole("link", { name: "common.timeline" });
    expectActiveNavPill(home, "common.timeline");
    expect(home.querySelector(".lucide-chevron-down")).not.toBeInTheDocument();
    expectCollapsedNavPill(screen.getByRole("link", { name: "common.attachments" }), "common.attachments");
    expect(screen.queryByRole("menuitem", { name: "common.explore" })).not.toBeInTheDocument();
  });

  it.each(["/explore", "/?creator=alice", "/spaces/test"])("shows Timeline display settings in every Timeline scope: %s", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    expect(
      within(screen.getByRole("navigation", { name: "common.primary-navigation" })).getByRole("button", { name: "memo.view-options" }),
    ).toBeInTheDocument();
  });

  it.each(["/calendar", "/map", "/attachments", "/archived", "/spaces/test/calendar"])(
    "hides Timeline display settings on other views: %s",
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppSidebar />
        </MemoryRouter>,
      );
      expect(screen.queryByRole("button", { name: "memo.view-options" })).not.toBeInTheDocument();
    },
  );

  it("opens the create form from the empty Views section and closes the mobile sidebar", () => {
    const LocationProbe = () => {
      const location = useLocation();
      return <output data-testid="view-destination">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
    };
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("button", { name: "setting.memo-view.create" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "setting.memo-view.create" }));
    expect(screen.getByTestId("view-destination")).toHaveTextContent(JSON.stringify({ pathname: "/views", state: { openCreate: true } }));
    expect(sidebarState.setMobileOpen).toHaveBeenCalledWith(false);
  });

  it("uses fixed-density text-only actions for a saved view", async () => {
    authState.memoViews = [{ name: "memoViews/1", title: "testgp" }];
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.edit testgp" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mu-s-sm");
    const editItem = screen.getByRole("menuitem", { name: "common.edit" });
    const deleteItem = screen.getByRole("menuitem", { name: "common.delete" });
    expect(editItem.querySelector("svg")).toBeNull();
    expect(deleteItem.querySelector("svg")).toBeNull();
    expect(deleteItem).toHaveClass("mu-menu-item-danger");
  });

  it("keeps collection navigation together with Home as a direct link", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const home = screen.getByRole("link", { name: "common.timeline" });
    expectCollapsedNavPill(home, "common.timeline");
    expect(home).toHaveAttribute("href", "/explore");
    expectActiveNavPill(screen.getByRole("link", { name: "common.attachments" }), "common.attachments");
  });

  it.each([
    ["/attachments", "common.attachments"],
    ["/inbox", "common.inbox"],
    ["/setting", "common.basic"],
  ])("labels the sidebar content section on %s", (path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: label, level: 2 })).toBeInTheDocument();
  });

  it.each(["/inbox", "/archived"])("shows Home as the direct destination from %s", (path) => {
    authState.currentUser = { name: "users/test", username: "test" };
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );
    const home = screen.getByRole("link", { name: "common.timeline" });
    expectDefaultNavPill(home, "common.timeline");
    expect(home).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "common.explore" })).not.toBeInTheDocument();
  });

  it("keeps the mobile header limited to navigation and context", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "common.open-navigation" })).toHaveAttribute("data-mobile-navigation-trigger");
    const mobileBrand = screen.getByRole("button", { name: "space.switch: common.memos" });
    expect(mobileBrand).toHaveClass("h-9", "gap-1.5", "px-1");
    expect(screen.queryByRole("button", { name: "common.search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
  });

  it("exposes Compose in the mobile navigation drawer", () => {
    sidebarState.mobileOpen = true;
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "common.search" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "editor.new-memo" }));
    expect(globalEditorState.openEditor).toHaveBeenCalledOnce();
  });

  it("keeps an accessible Close control in the mobile navigation drawer", () => {
    sidebarState.mobileOpen = true;
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppSidebar />
      </MemoryRouter>,
    );

    const close = screen.getByRole("button", { name: "common.close" });
    expect(screen.getByRole("dialog")).toContainElement(close);
    expect(close).toHaveClass("mu-visually-hidden");
    fireEvent.click(close);
    expect(sidebarState.setMobileOpen.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
