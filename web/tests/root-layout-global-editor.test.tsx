import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "@/layouts/RootLayout";

const authState = vi.hoisted(() => ({ currentUser: { name: "users/test" } as { name: string } | undefined }));
const instanceState = vi.hoisted(() => ({ accessMode: 2, instanceUrl: "https://example.com", demo: true }));

vi.mock("@/components/AppSidebar", () => ({
  default: () => <aside data-testid="desktop-sidebar">Desktop sidebar</aside>,
  MobileAppHeader: () => <header data-testid="mobile-header">Mobile header</header>,
  MobileAppSidebar: () => <aside data-testid="mobile-sidebar">Mobile sidebar</aside>,
  QuickFindDialog: () => <div data-testid="quick-find">Quick Find</div>,
  SIDEBAR_WIDTH_VAR: "--app-sidebar-width",
  SidebarResizeHandle: () => <div data-testid="resize-handle" />,
  useSidebarWidth: () => ({ width: 256, minWidth: 192, maxWidth: 384, setWidth: vi.fn() }),
}));

// GlobalMemoEditorContext is deliberately NOT mocked: the real provider calls
// useAppSidebar(), which throws unless RootLayout nests it inside
// AppSidebarProvider. That nesting is the only thing here that can break.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: true }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: instanceState }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  SpaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSpaceContext: () => ({ selectedSpaceName: undefined }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => authState.currentUser,
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  default: () => true,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const SHELL_TEST_IDS = ["desktop-sidebar", "mobile-sidebar", "mobile-header", "quick-find"];

const RouteState = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <output data-testid="route">{location.pathname}</output>
      <button type="button" onClick={() => navigate("/inbox")}>
        Open inbox
      </button>
    </div>
  );
};

describe("RootLayout global editor shell", () => {
  beforeEach(() => {
    authState.currentUser = { name: "users/test" };
    instanceState.accessMode = 2;
  });

  it("mounts the composer provider inside the sidebar provider and keeps the shell across routes", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="attachments" element={<RouteState />} />
            <Route path="inbox" element={<RouteState />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    for (const testId of SHELL_TEST_IDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    // The composer stays closed until something calls openEditor.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open inbox" }));

    expect(screen.getByTestId("route")).toHaveTextContent("/inbox");
    for (const testId of SHELL_TEST_IDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  it("gates anonymous visitors by access mode even when an instance URL is configured", () => {
    authState.currentUser = undefined;
    instanceState.accessMode = 1;

    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="explore" element={<div>Explore</div>} />
          </Route>
          <Route path="auth" element={<RouteState />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("route")).toHaveTextContent("/auth");
  });
});
