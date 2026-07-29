import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Navigation from "@/components/Navigation";

const mocks = vi.hoisted(() => ({
  openEditor: vi.fn(),
}));

vi.mock("@/components/MemosLogo", () => ({
  default: () => <span>Memos logo</span>,
}));

vi.mock("@/components/UserMenu", () => ({
  default: () => <div>User menu</div>,
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => ({ isOpen: false, openEditor: mocks.openEditor }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test" }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useNotifications: () => ({ data: [] }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("Navigation logo", () => {
  it("opens the global memo editor for an authenticated user", () => {
    render(
      <MemoryRouter>
        <Navigation collapsed />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.create common.memos" }));

    expect(mocks.openEditor).toHaveBeenCalledTimes(1);
  });
});
