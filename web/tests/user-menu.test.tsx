import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMenu from "@/components/UserMenu";

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  setMobileOpen: vi.fn(),
  logout: vi.fn(),
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
  });

  it("groups Archived with Profile and marks it active", async () => {
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <UserMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Steven/ }));

    const profile = await screen.findByRole("menuitem", { name: "common.profile" });
    const archived = screen.getByRole("menuitem", { name: "common.archived" });
    expect(profile.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archived).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    fireEvent.click(archived);
    expect(mocks.setMobileOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/archived");
  });
});
