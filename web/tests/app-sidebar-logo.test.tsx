import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as testingLibraryRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar, { MobileAppHeader } from "@/components/AppSidebar";
import { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";

const authState = vi.hoisted(() => ({
  currentUser: { name: "users/test" } as { name: string } | undefined,
  memoViews: [] as Array<{ name: string; title: string }>,
}));
const sidebarState = vi.hoisted(() => ({
  memoScope: "home" as "home" | "explore" | "archived",
}));

vi.mock("@/components/MemosLogo", () => ({
  default: () => <span>Memos logo</span>,
}));

vi.mock("@/components/MemoDisplaySettingMenu", () => ({
  default: () => <button type="button">memo.view-options</button>,
}));

vi.mock("@/components/UserMenu", () => ({
  default: () => <div>User menu</div>,
}));

vi.mock("@/components/StatisticsView", () => ({
  default: () => <div>Calendar</div>,
}));

vi.mock("@/components/AppSidebar/TagsSection", () => ({
  default: () => <div>Tags</div>,
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  useAppSidebar: () => ({
    attachmentSection: "all",
    setAttachmentSection: vi.fn(),
    inboxFilter: "all",
    setInboxFilter: vi.fn(),
    memoDetail: undefined,
    setMemoDetail: vi.fn(),
    mobileOpen: false,
    setMobileOpen: vi.fn(),
    quickFindOpen: false,
    setQuickFindOpen: vi.fn(),
    memoScope: sidebarState.memoScope,
    setMemoScope: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  stringifyFilters: () => "",
  useMemoFilterContext: () => ({
    filters: [],
    memoView: undefined,
    setMemoView: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => authState.currentUser,
}));

vi.mock("@/hooks/useFilteredMemoStats", () => ({
  useFilteredMemoStats: () => ({ statistics: { activityStats: {}, timeBasis: "create_time" }, tags: {} }),
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
  useNotifications: () => ({ data: [] }),
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

describe("App sidebar logo", () => {
  beforeEach(() => {
    authState.currentUser = { name: "users/test" };
    authState.memoViews = [];
    sidebarState.memoScope = "home";
  });

  it("navigates home instead of opening a global editor", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const logo = screen.getByRole("link", { name: "Memos logo" });
    expect(logo).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /create.*memos/i })).not.toBeInTheDocument();
    expect(screen.queryByText("common.calendar")).not.toBeInTheDocument();
  });

  it("shows the compact public navigation for a guest", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.explore" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "common.home" })).not.toBeInTheDocument();
  });

  it("falls back to the library content on a route without a specific tenant", () => {
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "common.statistics" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "common.statistics" })).not.toBeInTheDocument();
    expect(screen.getByText("common.views")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.attachments" })).toHaveAttribute("href", "/attachments");
    expect(screen.getByRole("link", { name: "common.inbox" })).toHaveAttribute("href", "/inbox");
    expect(screen.queryByRole("link", { name: "common.home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.about" })).not.toBeInTheDocument();
    expect(screen.getByText("User menu").closest("footer")).not.toBeNull();
  });

  it("uses a visitor sidebar for a guest on a route without contextual content", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("link", { name: "common.home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.attachments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
  });

  it("marks About active for a guest on the About page", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Calendar")).toBeInTheDocument();
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
    const createView = screen.getByRole("button", { name: "common.create" });
    expect(viewOptions.compareDocumentPosition(createView) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(createView).toHaveClass(...SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" "));
    expect(createView.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);
    const tasksView = screen.getByRole("button", { name: "common.tasks" });
    expect(tasksView).toHaveTextContent("common.tasks");
    expect(tasksView).not.toHaveTextContent("☑️");
    expect(screen.queryByRole("button", { name: "common.all" })).not.toBeInTheDocument();

    const scopeTrigger = screen.getByRole("button", { name: "common.home" });
    fireEvent.click(scopeTrigger);
    expect(await screen.findByRole("menuitem", { name: "common.home" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.explore" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.archived" })).toBeInTheDocument();
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

  it("collapses inactive global destinations and defaults the scope icon to Home", async () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const scopeTrigger = screen.getByRole("button", { name: "common.home" });
    expect(scopeTrigger).toHaveClass("size-[30px]");
    expect(scopeTrigger).not.toHaveTextContent("common.home");

    const inbox = screen.getByRole("link", { name: "common.inbox" });
    expect(inbox).toHaveClass("size-[30px]");
    expect(inbox).not.toHaveTextContent("common.inbox");

    const attachments = screen.getByRole("link", { name: "common.attachments" });
    expect(attachments).toHaveAttribute("aria-current", "page");
    expect(attachments).toHaveTextContent("common.attachments");

    fireEvent.click(scopeTrigger);
    expect(await screen.findByText("Calendar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.home" })).toHaveTextContent("common.home");
    expect(screen.queryByRole("menuitem", { name: "common.explore" })).not.toBeInTheDocument();
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

  it.each([
    ["explore", "common.explore", "/inbox"],
    ["archived", "common.archived", "/attachments"],
  ] as const)("keeps the %s scope available from a global destination", async (scope, label, destination) => {
    sidebarState.memoScope = scope;
    render(
      <MemoryRouter initialEntries={[destination]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const scopeTrigger = screen.getByRole("button", { name: label });
    expect(scopeTrigger).toHaveClass("size-[30px]");
    expect(scopeTrigger).not.toHaveTextContent(label);

    fireEvent.click(scopeTrigger);
    expect(await screen.findByRole("button", { name: label })).toHaveTextContent(label);
  });

  it("keeps the mobile brand beside navigation without a duplicate search action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileAppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Memos logo" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "common.search" })).not.toBeInTheDocument();
  });
});
