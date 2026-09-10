import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, render as testingLibraryRender, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar, { MobileAppHeader, MobileAppSidebar } from "@/components/AppSidebar";
import { SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { type MemoFilter, parseFilterQuery } from "@/contexts/MemoFilterContext";
import { resolveCollectionRoute } from "@/router/routes";

const authState = vi.hoisted(() => ({
  currentUser: { name: "users/test" } as { name: string } | undefined,
  memoViews: [] as Array<{ name: string; title: string }>,
  notifications: [] as Array<{ status: number }>,
}));
const sidebarState = vi.hoisted(() => ({
  memoScope: "home" as "home" | "explore",
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
  default: ({ size, collapsed }: { size?: string; collapsed?: boolean }) => (
    <span data-logo-size={size} data-logo-collapsed={collapsed ? "true" : undefined}>
      {collapsed ? "Memos mark" : "Memos logo"}
    </span>
  ),
}));

vi.mock("@/components/MemoDisplaySettingMenu", () => ({
  default: () => <button type="button">memo.view-options</button>,
}));

vi.mock("@/components/UserMenu", () => ({
  default: ({ collapsed }: { collapsed?: boolean }) => (
    <button type="button" className={collapsed ? "size-12 rounded-xl" : "w-full"}>
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
    memoScope: sidebarState.memoScope,
    setMemoScope: vi.fn(),
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
    const { spaceName } = resolveCollectionRoute(useLocation().pathname);
    const duplicateSpaceTitles = new Set(
      spaceState.spaces
        .filter((space, index) => spaceState.spaces.findIndex((candidate) => candidate.title === space.title) !== index)
        .map((space) => space.title),
    );
    return {
      ...spaceState,
      selectedSpaceName: spaceName,
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
  useUser: () => ({ data: undefined }),
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

// Icon-rail destinations are always icon-only squares; the accessible name lives on aria-label.
const expectNavIcon = (control: HTMLElement, label: string) => {
  expect(control).toHaveClass("size-12", "rounded-xl");
  expect(control).toHaveAttribute("aria-label", label);
  expect(control.querySelector('span.grid[aria-hidden="true"]')).toBeNull();
  expect(control.querySelector("svg.lucide")).not.toBeNull();
};

const expectCollapsedNavPill = (pill: HTMLElement, label: string) => {
  expectNavIcon(pill, label);
};

const expectExpandedNavPill = (pill: HTMLElement, label: string) => {
  expectNavIcon(pill, label);
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
    sidebarState.memoScope = "home";
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

  it("preserves a CEL expression when switching sidebar scopes", async () => {
    const expression = 'tags.exists(t, t.contains("50%, café & C++"))\n || pinned';
    filterState.filters = [{ factor: "celSearch", value: expression }];
    const LocationProbe = () => {
      const location = useLocation();
      return (
        <output data-testid="scope-location">
          {JSON.stringify({ path: location.pathname, filters: parseFilterQuery(new URLSearchParams(location.search).get("filter")) })}
        </output>
      );
    };
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "common.explore" }));
    expect(screen.getByTestId("scope-location")).toHaveTextContent(JSON.stringify({ path: "/explore", filters: filterState.filters }));
  });

  it("shows the context switcher and opens the global memo editor", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const switcher = screen.getByRole("button", { name: "space.switch: common.memos" });
    const header = switcher.closest("[data-sidebar-header]");
    const compose = screen.getByRole("button", { name: "editor.new-memo" });
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });

    expect(header).toHaveClass("h-13", "px-3");
    // Brand mark lives on the icon rail; the switcher only names the context.
    expect(switcher).toHaveTextContent("common.memos");
    expect(within(switcher).queryByText("Memos logo")).toBeNull();
    expect(within(switcher).queryByText("Memos mark")).toBeNull();
    expect(switcher).toHaveClass("min-w-0", "h-9", "gap-2", "px-2");
    expect(switcher).not.toHaveClass("px-1");
    expect(switcher.querySelector(".lucide-chevrons-up-down")).not.toBeNull();
    expect(switcher.querySelector(".lucide-chevron-down")).toBeNull();
    expect(compose).toHaveClass("size-7", "rounded-md", "border", "bg-background", "shadow-xs");
    expect(compose).not.toHaveClass("rounded-full");
    // Search is an always-visible input under the brand row, not a modal trigger.
    const search = screen.getByRole("searchbox", { name: "common.search" });
    expect(search).toHaveAttribute("data-sidebar-search-input");
    expect(header).not.toContainElement(search);
    expect(within(primaryNavigation).queryByRole("searchbox", { name: "common.search" })).toBeNull();
    // Rail carries a single enlarged mark-only logo.
    const railLogo = within(primaryNavigation).getByRole("link", { name: "Memos" });
    expect(within(railLogo).getByText("Memos mark")).toHaveAttribute("data-logo-size", "rail");

    fireEvent.click(compose);
    expect(globalEditorState.openEditor).toHaveBeenCalledOnce();
    // Calendar is no longer a rail destination; the statistics calendar stays off this route.
    expect(within(primaryNavigation).queryByRole("link", { name: "common.calendar" })).toBeNull();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it.each([
    "/spaces/product",
    "/spaces/product/explore",
    "/spaces/product/attachments",
    "/spaces/product/Explore/",
    "/spaces/product/Attachments/",
  ])("shows the selected Space only on collection route %s", (path) => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    spaceState.spaces = [product];
    spaceState.selectedSpace = product;

    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "space.switch: Product" })).toBeInTheDocument();
  });

  it.each([
    "/archived",
    "/inbox",
    "/u/alice",
    "/setting",
    "/about",
    "/views",
    "/memos/123",
    "/memos/shares/token",
    "/404",
  ])("shows Memos in the switcher on global page %s", (path) => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    spaceState.spaces = [product];
    spaceState.selectedSpace = product;

    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const brand = screen.getByRole("button", { name: "space.switch: common.memos" });
    expect(brand).toHaveClass("h-9", "gap-2", "px-2");
    // No second logo mark in the panel; the rail owns the brand.
    expect(within(brand).queryByText("Memos logo")).toBeNull();
    expect(within(brand).queryByText("Memos mark")).toBeNull();
    expect(brand).toHaveTextContent("common.memos");
  });

  it("scopes collection statistics to the selected Space", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/product/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "explore", filter: 'space == "spaces/product"' }));
  });

  it("includes authorized Space memos in All Explore statistics", () => {
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "explore", filter: undefined }));
  });

  it("keeps Profile statistics and tag UI state unscoped by Space", () => {
    render(
      <MemoryRouter initialEntries={["/u/alice"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "profile", filter: undefined }));
    expect(tagsSectionHook).toHaveBeenCalledWith(expect.objectContaining({ scope: "profile" }));
  });

  it("keeps Archived statistics and tag UI state unscoped by Space", () => {
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "archived", filter: undefined }));
    expect(tagsSectionHook).toHaveBeenCalledWith(expect.objectContaining({ scope: "archived" }));
  });

  it("uses one unified signed-in account control on the icon rail", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const account = screen.getByRole("button", { name: "User menu" });
    // Account lives at the bottom of the left icon rail, not in a full-width footer.
    expect(account.closest("nav")).not.toBeNull();
    expect(account).toHaveClass("size-12", "rounded-xl");
    expect(account).not.toHaveClass("w-full");
    expect(account).not.toHaveClass("px-5");
    // Inbox is a rail destination; it is not duplicated as a footer action.
    expectNavIcon(screen.getByRole("link", { name: "common.inbox" }), "common.inbox");
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
    expect(screen.getByRole("searchbox", { name: "common.search" })).toBeInTheDocument();
  });

  it("shows the compact public navigation for a guest", () => {
    authState.currentUser = undefined;
    globalEditorState.canOpen = false;
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Memos" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("button", { name: /^space\.switch:/ })).not.toBeInTheDocument();
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(primaryNavigation).toHaveClass("flex-col", "w-18", "items-center", "gap-1", "border-e");
    expect(primaryNavigation).not.toHaveClass("h-7", "px-3");
    const navigation = within(primaryNavigation);
    // Guest rail has no search; Quick Find is not offered without a signed-in panel.
    expect(navigation.queryByRole("button", { name: "common.search" })).toBeNull();
    expectActiveNavPill(navigation.getByRole("link", { name: "common.explore" }), "common.explore");
    const about = navigation.getByRole("link", { name: "common.about" });
    expect(about).toHaveAttribute("href", "/about");
    expectCollapsedNavPill(about, "common.about");
    const signIn = screen.getByRole("link", { name: "common.sign-in-to-memos" });
    expect(signIn).toHaveClass("size-12", "rounded-xl");
    expect(signIn).not.toHaveClass("w-full", "px-5");
    expect(signIn.closest("nav")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.home" })).not.toBeInTheDocument();
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
    const navigation = within(screen.getByRole("navigation", { name: "Primary" }));
    expectDefaultNavPill(navigation.getByRole("link", { name: "common.memos" }), "common.memos");
    const attachments = navigation.getByRole("link", { name: "common.attachments" });
    expect(attachments).toHaveAttribute("href", "/attachments");
    expectCollapsedNavPill(attachments, "common.attachments");
    expectNavIcon(navigation.getByRole("link", { name: "common.inbox" }), "common.inbox");
    expect(navigation.getByRole("link", { name: "Navigation" })).toHaveAttribute("href", "/navigation");
    expect(screen.getByText("User menu").closest("nav")).not.toBeNull();
  });

  it.each(["/about", "/About/"])("marks the common About link active on %s", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "common.resources", level: 2 })).toBeInTheDocument();

    const navigation = within(screen.getByRole("navigation", { name: "Primary" }));
    expectDefaultNavPill(navigation.getByRole("link", { name: "common.memos" }), "common.memos");
    expectDefaultNavPill(navigation.getByRole("link", { name: "common.explore" }), "common.explore");
    expectCollapsedNavPill(navigation.getByRole("link", { name: "common.attachments" }), "common.attachments");
    expectNavIcon(navigation.getByRole("link", { name: "common.inbox" }), "common.inbox");
    expect(navigation.getByRole("link", { name: "Navigation" })).toHaveAttribute("href", "/navigation");
  });

  it("uses a visitor sidebar for a guest on a route without contextual content", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = within(screen.getByRole("navigation", { name: "Primary" }));
    const explore = navigation.getByRole("link", { name: "common.explore" });
    expect(explore).toHaveAttribute("href", "/explore");
    expectDefaultNavPill(explore, "common.explore");
    expect(screen.queryByRole("link", { name: "common.memos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.attachments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
    const about = navigation.getByRole("link", { name: "common.about" });
    expect(about).toHaveAttribute("href", "/about");
    expectCollapsedNavPill(about, "common.about");
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("nav")).not.toBeNull();
  });

  it.each(["/about", "/About/"])("marks About active for a guest on %s", (path) => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = within(screen.getByRole("navigation", { name: "Primary" }));
    expectCollapsedNavPill(navigation.getByRole("link", { name: "common.explore" }), "common.explore");
    expectActiveNavPill(navigation.getByRole("link", { name: "common.about" }), "common.about");
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it("keeps views below the calendar and marks Home active as a rail link", async () => {
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
    const createView = screen.getByRole("button", { name: "common.create" });
    expect(viewOptions.compareDocumentPosition(createView) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(createView).toHaveClass("size-6", "rounded-md", "text-muted-foreground/70", "hover:bg-muted/60", "hover:text-foreground");
    expect(createView.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);
    const tasksView = screen.getByRole("button", { name: "common.tasks" });
    expect(tasksView).toHaveTextContent("common.tasks");
    expect(tasksView).not.toHaveTextContent("☑️");
    expect(screen.queryByRole("button", { name: "common.all" })).not.toBeInTheDocument();

    const home = screen.getByRole("link", { name: "common.memos" });
    expectActiveNavPill(home, "common.memos");
    expect(home.querySelector(".lucide-chevrons-up-down")).not.toBeInTheDocument();
    expectCollapsedNavPill(screen.getByRole("link", { name: "common.attachments" }), "common.attachments");
    expectDefaultNavPill(screen.getByRole("link", { name: "common.explore" }), "common.explore");
  });

  it("uses compact text-only actions for a saved view", async () => {
    authState.memoViews = [{ name: "memoViews/1", title: "testgp" }];
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.edit testgp" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("data-size", "sm");
    expect(menu).toHaveClass("min-w-24", "p-0.5");
    const editItem = screen.getByRole("menuitem", { name: "common.edit" });
    const deleteItem = screen.getByRole("menuitem", { name: "common.delete" });
    expect(editItem.querySelector("svg")).toBeNull();
    expect(deleteItem.querySelector("svg")).toBeNull();
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
  });

  it("keeps collection navigation together and uses the account control on the rail", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const home = screen.getByRole("link", { name: "common.memos" });
    expectDefaultNavPill(home, "common.memos");

    expect(screen.getByRole("button", { name: "User menu" }).closest("nav")).not.toBeNull();
    expectNavIcon(screen.getByRole("link", { name: "common.inbox" }), "common.inbox");

    const attachments = screen.getByRole("link", { name: "common.attachments" });
    expectActiveNavPill(attachments, "common.attachments");
  });

  it.each([
    ["/attachments", "common.attachments"],
    ["/inbox", "common.inbox"],
    ["/setting", "common.basic"],
    ["/u/test", "common.profile"],
  ])("labels the sidebar content section on %s", (path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: label, level: 2 })).toBeInTheDocument();
  });

  it("keeps the Explore destination available from a global route", async () => {
    sidebarState.memoScope = "explore";
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const explore = screen.getByRole("link", { name: "common.explore" });
    expectDefaultNavPill(explore, "common.explore");
    expectCollapsedNavPill(screen.getByRole("link", { name: "common.attachments" }), "common.attachments");

    fireEvent.click(explore);
    expectActiveNavPill(await screen.findByRole("link", { name: "common.explore", current: "page" }), "common.explore");
  });

  it("leaves Archived through the remembered primary feed without presenting it as a scope", async () => {
    sidebarState.memoScope = "explore";
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const explore = screen.getByRole("link", { name: "common.explore" });
    expectDefaultNavPill(explore, "common.explore");
    expectCollapsedNavPill(screen.getByRole("link", { name: "common.attachments" }), "common.attachments");

    fireEvent.click(explore);
    expectActiveNavPill(await screen.findByRole("link", { name: "common.explore", current: "page" }), "common.explore");
  });

  it("keeps the mobile header limited to navigation and context", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("data-mobile-navigation-trigger");
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

    expect(screen.getByRole("searchbox", { name: "common.search" })).toBeInTheDocument();
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

    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close" });
    expect(dialog).toHaveClass("[&>[data-slot=sheet-close]]:sr-only");
    expect(close).toHaveAttribute("data-slot", "sheet-close");
    fireEvent.click(close);
    expect(sidebarState.setMobileOpen.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
