import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "@/layouts/RootLayout";

const profileState = vi.hoisted(() => ({
  profile: { instanceUrl: "", allowPublicAccess: false },
}));

let currentUser: { username: string } | null = null;

vi.mock("@/components/AppSidebar", () => ({
  default: () => <div data-testid="app-sidebar" />,
  MobileAppHeader: () => null,
  MobileAppSidebar: () => null,
  QuickFindDialog: () => null,
  SIDEBAR_WIDTH_VAR: "--app-sidebar-width",
  SidebarResizeHandle: () => null,
  useSidebarWidth: () => ({ width: 240, minWidth: 200, maxWidth: 360, setWidth: vi.fn() }),
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  AppSidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => profileState,
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  MemoFilterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMemoFilterContext: () => ({ removeFilter: vi.fn() }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => currentUser,
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  default: () => false,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/explore" element={<div>explore content</div>} />
        </Route>
        <Route path="/auth" element={<div>sign-in content</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RootLayout public-access route gating", () => {
  beforeEach(() => {
    currentUser = null;
    profileState.profile = { instanceUrl: "", allowPublicAccess: false };
  });

  it("redirects anonymous visitors away from Explore when public access is disabled", () => {
    profileState.profile = {
      instanceUrl: "https://memos.example.com",
      allowPublicAccess: false,
    };

    renderAt("/explore");

    expect(screen.getByText("sign-in content")).toBeInTheDocument();
    expect(screen.queryByText("explore content")).not.toBeInTheDocument();
  });

  it("keeps Explore available when public access is enabled, even with no instance URL", () => {
    profileState.profile = {
      instanceUrl: "",
      allowPublicAccess: true,
    };

    renderAt("/explore");

    expect(screen.getByText("explore content")).toBeInTheDocument();
  });

  it("does not gate authenticated users on a private instance", () => {
    currentUser = { username: "steven" };
    profileState.profile = {
      instanceUrl: "https://memos.example.com",
      allowPublicAccess: false,
    };

    renderAt("/explore");

    expect(screen.getByText("explore content")).toBeInTheDocument();
  });
});
