import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { badgeClasses } from "@usememos/ui";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCOPE_PANEL_ROW_CLASSES } from "@/components/AppSidebar/sidebar-layout";
import UserMenu from "@/components/UserMenu";
import { loadLocale } from "@/utils/i18n";
import { loadTheme } from "@/utils/theme";

const mocks = vi.hoisted(() => ({
  setMobileOpen: vi.fn(),
  onClose: vi.fn(),
  logout: vi.fn(),
  updateGeneralSetting: vi.fn(),
  refetchSettings: vi.fn(),
  currentUser: { name: "users/steven", username: "steven", displayName: "Steven" } as
    | { name: string; username: string; displayName: string }
    | undefined,
  notifications: [] as Array<{ status: number }>,
}));

vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setMobileOpen: mocks.setMobileOpen }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userGeneralSetting: undefined, refetchSettings: mocks.refetchSettings, logout: mocks.logout }),
}));
vi.mock("@/hooks/useLiveMemoRefresh", () => ({ useSSEConnectionStatus: () => "connected" }));
vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => mocks.currentUser,
}));
vi.mock("@/hooks/useUserQueries", () => ({
  useNotifications: () => ({ data: mocks.notifications }),
  useUpdateUserGeneralSetting: () => ({ mutate: mocks.updateGeneralSetting }),
}));
vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  loadLocale: vi.fn((await importOriginal<typeof import("@/utils/i18n")>()).loadLocale),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/utils/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/theme")>()),
  loadTheme: vi.fn((await importOriginal<typeof import("@/utils/theme")>()).loadTheme),
}));

const renderMenu = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <UserMenu onClose={mocks.onClose} />
    </MemoryRouter>,
  );

describe("User menu panel", () => {
  beforeEach(() => {
    mocks.currentUser = { name: "users/steven", username: "steven", displayName: "Steven" };
    localStorage.clear();
    localStorage.setItem("memos-locale", "en");
    localStorage.setItem("memos-theme", "system");
    vi.mocked(loadTheme).mockClear();
    vi.mocked(loadLocale).mockClear();
    mocks.setMobileOpen.mockReset();
    mocks.onClose.mockReset();
    mocks.logout.mockReset();
    mocks.updateGeneralSetting.mockReset();
    mocks.refetchSettings.mockReset();
    mocks.notifications = [];
  });

  it("signs out to manual sign-in so an active SSO session cannot immediately sign back in", async () => {
    const originalLocation = window.location;
    const replace = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, replace } });
    try {
      renderMenu();
      fireEvent.click(screen.getByRole("button", { name: "common.sign-out" }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth?auto_sign_in=false"));
      expect(mocks.logout).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("places Inbox beside the account and Archived directly above Settings", () => {
    renderMenu("/archived");
    const accountHeader = screen.getByText("Steven").parentElement!;
    const inbox = within(accountHeader).getByRole("link", { name: "common.inbox" });
    const archived = screen.getByRole("link", { name: "common.archived" });
    expect(screen.queryByText("setting.sso.account")).not.toBeInTheDocument();
    expect(inbox).toHaveClass(...badgeClasses({ tone: "neutral" }).split(" "));
    expect(inbox.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archived.nextElementSibling).toBe(screen.getByRole("link", { name: "common.settings" }));
    expect(archived).toHaveAttribute("aria-current", "page");
    expect(archived).toHaveAttribute("href", "/archived");
    fireEvent.click(archived);
    expect(mocks.onClose).toHaveBeenCalledOnce();
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
  });

  it("draws every row on one panel row grammar so icons share one column", () => {
    renderMenu("/");
    const rows = [
      screen.getByRole("button", { name: /setting.preference.theme/ }),
      screen.getByRole("button", { name: /common.language/ }),
      screen.getByRole("link", { name: "common.archived" }),
      screen.getByRole("link", { name: "common.settings" }),
      screen.getByRole("link", { name: "common.about" }),
      screen.getByRole("button", { name: "common.sign-out" }),
    ];
    for (const row of rows) {
      // Every row is the package's menu row, so height, padding, gap and type line up. Color may differ (Sign out is quieter).
      expect(row).toHaveClass("mu-menu-item");
      expect(SCOPE_PANEL_ROW_CLASSES).toContain("mu-menu-item");
    }
  });

  it("shows unread Inbox count and navigates from the same panel", () => {
    mocks.notifications = [{ status: 1 }, { status: 1 }, { status: 2 }];
    renderMenu("/Inbox/");
    const inbox = screen.getByRole("link", { name: "common.inbox, 2 inbox.unread" });
    expect(inbox).toHaveAttribute("aria-current", "page");
    expect(inbox).toHaveTextContent("2");
    expect(inbox).toHaveAttribute("href", "/inbox");
  });

  it("offers guests preferences and About without account pages or a second sign-in", () => {
    mocks.currentUser = undefined;
    renderMenu("/explore");
    expect(screen.getByRole("button", { name: /setting.preference.theme/ })).toBeInTheDocument();
    for (const name of ["common.inbox", "common.archived", "common.settings", "common.sign-out", "common.sign-in"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    const about = screen.getByRole("link", { name: "common.about" });
    expect(about).toHaveAttribute("href", "/about");
    fireEvent.click(about);
    expect(mocks.onClose).toHaveBeenCalledOnce();
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
  });

  it("shows current preferences on rows that open their choices as submenus", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /setting.preference.theme.*setting.preference.theme-system/ }));
    const themes = await screen.findByRole("menu");
    expect(within(themes).getByRole("menuitemradio", { name: "setting.preference.theme-system" })).toHaveAttribute("aria-checked", "true");
    expect(
      within(themes)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual([
      "setting.preference.theme-system",
      "setting.preference.theme-light",
      "setting.preference.theme-dark",
      "setting.preference.theme-paper",
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([/setting.preference.theme/, /common.language/])("keeps the %s submenu fixed after positioning", async (row) => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: row }));
    const menu = await screen.findByRole("menu");
    const positioner = menu.parentElement as HTMLElement;
    await waitFor(() => {
      expect(positioner.style.opacity).not.toBe("0");
      expect(positioner.style.position).toBe("fixed");
    });
  });

  it.each([
    {
      row: /setting.preference.theme/,
      choice: "setting.preference.theme-dark",
      load: loadTheme,
      value: "default-dark",
      field: "theme",
      label: /setting.preference.theme.*setting.preference.theme-dark/,
    },
    { row: /common.language/, choice: "Français", load: loadLocale, value: "fr", field: "locale", label: /common.language.*Français/ },
  ] as const)("applies and saves $field from its submenu", async ({ row, choice, load, value, field, label }) => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: row }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: choice }));
    expect(load).toHaveBeenCalledWith(value);
    expect(mocks.updateGeneralSetting).toHaveBeenCalledWith(
      { generalSetting: { [field]: value }, updateMask: [field] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it.each([
    {
      row: /setting.preference.theme/,
      choice: "setting.preference.theme-dark",
      storageKey: "memos-theme",
      value: "default-dark",
      label: /setting.preference.theme.*setting.preference.theme-dark/,
    },
    { row: /common.language/, choice: "Français", storageKey: "memos-locale", value: "fr", label: /common.language.*Français/ },
  ] as const)("persists a guest's choice of $storageKey locally without updating an account", async ({
    row,
    choice,
    storageKey,
    value,
    label,
  }) => {
    mocks.currentUser = undefined;
    const menu = renderMenu("/explore");
    fireEvent.click(screen.getByRole("button", { name: row }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: choice }));
    expect(localStorage.getItem(storageKey)).toBe(value);
    expect(mocks.updateGeneralSetting).not.toHaveBeenCalled();
    expect(mocks.refetchSettings).not.toHaveBeenCalled();
    menu.unmount();
    renderMenu("/explore");
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});
