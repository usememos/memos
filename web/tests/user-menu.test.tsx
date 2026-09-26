import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMenu, { UserPreferenceDialog } from "@/components/UserMenu";
import { loadLocale } from "@/utils/i18n";
import { loadTheme } from "@/utils/theme";

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  setMobileOpen: vi.fn(),
  onSelectPreference: vi.fn(),
  onClose: vi.fn(),
  logout: vi.fn(),
  updateGeneralSetting: vi.fn(),
  refetchSettings: vi.fn(),
  notifications: [] as Array<{ status: number }>,
}));

vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setMobileOpen: mocks.setMobileOpen }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userGeneralSetting: undefined, refetchSettings: mocks.refetchSettings, logout: mocks.logout }),
}));
vi.mock("@/hooks/useLiveMemoRefresh", () => ({ useSSEConnectionStatus: () => "connected" }));
vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/steven", username: "steven", displayName: "Steven" }),
}));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => mocks.navigateTo }));
vi.mock("@/hooks/useUserQueries", () => ({
  useNotifications: () => ({ data: mocks.notifications }),
  useUpdateUserGeneralSetting: () => ({ mutate: mocks.updateGeneralSetting }),
}));
vi.mock("@/components/LocalePicker", () => ({
  LocaleSearchList: ({ onChange }: { onChange: (locale: string) => void }) => (
    <button type="button" onClick={() => onChange("fr")}>
      Choose French
    </button>
  ),
}));
vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  getLocaleWithFallback: () => "en",
  loadLocale: vi.fn(),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/utils/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/theme")>()),
  getThemeWithFallback: () => "system",
  loadTheme: vi.fn(),
}));

const renderMenu = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <UserMenu onSelectPreference={mocks.onSelectPreference} onClose={mocks.onClose} />
    </MemoryRouter>,
  );

describe("User menu panel", () => {
  beforeEach(() => {
    mocks.navigateTo.mockReset();
    mocks.setMobileOpen.mockReset();
    mocks.onSelectPreference.mockReset();
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

  it("shows current preferences as direct rows", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /setting.preference.theme.*Sync with system/ }));
    fireEvent.click(screen.getByRole("button", { name: /common.language.*English/ }));
    expect(mocks.onSelectPreference.mock.calls).toEqual([["theme"], ["language"]]);
    expect(screen.getByRole("button", { name: "common.settings" })).toBeInTheDocument();
  });

  it("applies a theme from a separate dialog", () => {
    render(
      <MemoryRouter>
        <UserPreferenceDialog preference="theme" onClose={mocks.onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(loadTheme).toHaveBeenCalledWith("default-dark");
    expect(mocks.updateGeneralSetting).toHaveBeenCalledWith(
      { generalSetting: { theme: "default-dark" }, updateMask: ["theme"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });

  it("applies a locale from a separate dialog", () => {
    render(
      <MemoryRouter>
        <UserPreferenceDialog preference="language" onClose={mocks.onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose French" }));
    expect(loadLocale).toHaveBeenCalledWith("fr");
    expect(mocks.updateGeneralSetting).toHaveBeenCalledWith(
      { generalSetting: { locale: "fr" }, updateMask: ["locale"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });
});
