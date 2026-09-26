import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMenu from "@/components/UserMenu";
import { loadLocale } from "@/utils/i18n";
import { loadTheme } from "@/utils/theme";

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
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
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => mocks.navigateTo }));
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
    mocks.navigateTo.mockReset();
    mocks.setMobileOpen.mockReset();
    mocks.onClose.mockReset();
    mocks.logout.mockReset();
    mocks.updateGeneralSetting.mockReset();
    mocks.refetchSettings.mockReset();
    mocks.notifications = [];
  });

  it("places Inbox beside the account and Archived directly above Settings", () => {
    renderMenu("/archived");
    const accountHeader = screen.getByText("Steven").parentElement!;
    const inbox = within(accountHeader).getByRole("button", { name: "common.inbox" });
    const archived = screen.getByRole("button", { name: "common.archived" });
    expect(screen.queryByText("setting.sso.account")).not.toBeInTheDocument();
    expect(inbox).toHaveClass("h-5", "text-[10px]");
    expect(inbox.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archived.nextElementSibling).toBe(screen.getByRole("button", { name: "common.settings" }));
    expect(archived).toHaveClass("bg-accent");
    fireEvent.click(archived);
    expect(mocks.onClose).toHaveBeenCalledOnce();
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/archived");
  });

  it("shows unread Inbox count and navigates from the same panel", () => {
    mocks.notifications = [{ status: 1 }, { status: 1 }, { status: 2 }];
    renderMenu("/Inbox/");
    const inbox = screen.getByRole("button", { name: "common.inbox, 2 inbox.unread" });
    expect(inbox).toHaveClass("bg-accent");
    expect(inbox).toHaveTextContent("2");
    fireEvent.click(inbox);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/inbox");
  });

  it("offers guests preferences and About without account pages or a second sign-in", () => {
    mocks.currentUser = undefined;
    renderMenu("/explore");
    expect(screen.getByRole("button", { name: /setting.preference.theme/ })).toBeInTheDocument();
    for (const name of ["common.inbox", "common.archived", "common.settings", "common.sign-out", "common.sign-in"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "common.about" }));
    expect(mocks.onClose).toHaveBeenCalledOnce();
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/about");
  });

  it("shows current preferences on rows that open their choices as submenus", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /setting.preference.theme.*Sync with system/ }));
    const themes = await screen.findByRole("menu");
    expect(within(themes).getByRole("menuitemradio", { name: "Sync with system" })).toHaveAttribute("aria-checked", "true");
    expect(
      within(themes)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual(["Sync with system", "Light", "Dark", "Paper"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    {
      row: /setting.preference.theme/,
      choice: "Dark",
      load: loadTheme,
      value: "default-dark",
      field: "theme",
      label: /setting.preference.theme.*Dark/,
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
      choice: "Dark",
      storageKey: "memos-theme",
      value: "default-dark",
      label: /setting.preference.theme.*Dark/,
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
