import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({
    profile: { needsSetup: false },
    profileLoaded: true,
    generalSetting: {},
  }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  MemoFilterProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/useNavigateTo", () => ({ default: () => vi.fn() }));
vi.mock("@/hooks/useUserLocale", () => ({ useUserLocale: vi.fn() }));
vi.mock("@/hooks/useUserTheme", () => ({ useUserTheme: vi.fn() }));
vi.mock("@/utils/oauth", () => ({ cleanupExpiredOAuthState: vi.fn() }));

describe("scroll restoration", () => {
  let scrollY = 0;

  beforeEach(() => {
    scrollY = 0;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollY,
    });
  });

  it("resets new routes and restores history entries", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((xOrOptions, y) => {
      scrollY = typeof xOrOptions === "number" ? (y ?? 0) : (xOrOptions.top ?? 0);
    });
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <App />,
          children: [
            { index: true, element: <div>First page</div> },
            { path: "second", element: <div>Second page</div> },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("First page");
    scrollTo.mockClear();

    scrollY = 640;
    await act(async () => {
      await router.navigate("/second");
    });
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith(0, 0));

    scrollY = 180;
    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith(0, 640));
  });
});
