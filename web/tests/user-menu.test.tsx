import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMenu from "@/components/UserMenu";

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  setMobileOpen: vi.fn(),
  logout: vi.fn(),
  notifications: [] as Array<{ status: number }>,
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  useAppSidebar: () => ({ setMobileOpen: mocks.setMobileOpen }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    userGeneralSetting: undefined,
    refetchSettings: vi.fn(),
    logout: mocks.logout,
  }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/steven", username: "steven", displayName: "Steven" }),
}));

vi.mock("@/hooks/useLiveMemoRefresh", () => ({
  useSSEConnectionStatus: () => "connected",
}));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => mocks.navigateTo,
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useNotifications: () => ({ data: mocks.notifications }),
  useUpdateUserGeneralSetting: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/utils/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/i18n")>();
  return {
    ...actual,
    getLocaleWithFallback: () => "en",
    loadLocale: vi.fn(),
    useTranslate: () => (key: string) => key,
  };
});

describe("User menu", () => {
  beforeEach(() => {
    mocks.navigateTo.mockReset();
    mocks.setMobileOpen.mockReset();
    mocks.logout.mockReset();
    mocks.notifications = [];
  });

  it("groups Inbox and Archived with Profile and marks Archived active", async () => {
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <UserMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Steven/ }));

    const profile = await screen.findByRole("menuitem", { name: "common.profile" });
    const inbox = screen.getByRole("menuitem", { name: "common.inbox" });
    const archived = screen.getByRole("menuitem", { name: "common.archived" });
    expect(profile.compareDocumentPosition(inbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inbox.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archived).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    fireEvent.click(archived);
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/archived");
  });

  it("uses a vertical ellipsis trigger, inset menu width, and preserves the Inbox unread state", async () => {
    mocks.notifications = [{ status: 1 }, { status: 1 }, { status: 2 }];
    render(
      <MemoryRouter initialEntries={["/Inbox/"]}>
        <UserMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Steven, common.more, 2 inbox.unread" });
    expect(trigger).toHaveClass("h-9", "w-full", "gap-1", "rounded-md", "px-2");
    expect(trigger.firstElementChild).toHaveClass("size-5");
    expect(trigger.querySelector(".lucide-ellipsis-vertical")).not.toBeNull();
    expect(trigger.querySelector(".lucide-chevrons-up-down")).toBeNull();
    expect(trigger.querySelector("[data-inbox-unread-indicator]")).not.toBeNull();
    fireEvent.click(trigger);

    const inbox = await screen.findByRole("menuitem", { name: "common.inbox, 2 inbox.unread" });
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("w-[var(--anchor-width)]");
    expect(menu).not.toHaveClass("min-w-56");
    expect(inbox).toHaveAttribute("aria-current", "page");
    expect(inbox).toHaveTextContent("common.inbox");
    expect(inbox).toHaveTextContent("2");

    fireEvent.click(inbox);
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/inbox");
  });
});
