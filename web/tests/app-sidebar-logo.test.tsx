import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar, { MobileAppHeader } from "@/components/AppSidebar";

const authState = vi.hoisted(() => ({ currentUser: { name: "users/test" } as { name: string } | undefined }));
const sidebarState = vi.hoisted(() => ({
  memoScope: "home" as "home" | "explore" | "archived",
  setAboutOpen: vi.fn(),
}));

vi.mock("@/components/MemosLogo", () => ({
  default: () => <span>Memos logo</span>,
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
    aboutOpen: false,
    setAboutOpen: sidebarState.setAboutOpen,
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
  useAuth: () => ({ shortcuts: [], refetchSettings: vi.fn(), isInitialized: true }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  stringifyFilters: () => "",
  useMemoFilterContext: () => ({
    filters: [],
    shortcut: undefined,
    setShortcut: vi.fn(),
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
  useNotifications: () => ({ data: [] }),
  useUser: () => ({ data: undefined }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("App sidebar logo", () => {
  beforeEach(() => {
    authState.currentUser = { name: "users/test" };
    sidebarState.memoScope = "home";
    sidebarState.setAboutOpen.mockReset();
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
    fireEvent.click(screen.getByRole("button", { name: "common.about" }));
    expect(sidebarState.setAboutOpen).toHaveBeenCalledWith(true);
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "common.home" })).not.toBeInTheDocument();
  });

  it("uses a compact scope menu and places views below the calendar", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const calendar = screen.getByText("Calendar");
    const views = screen.getByText("common.views");
    expect(calendar.compareDocumentPosition(views) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.tasks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.all" })).not.toBeInTheDocument();

    const scopeTrigger = screen.getByRole("button", { name: "common.home" });
    fireEvent.click(scopeTrigger);
    expect(await screen.findByRole("menuitem", { name: "common.home" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.explore" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.archived" })).toBeInTheDocument();
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
