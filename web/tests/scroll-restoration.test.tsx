import { useDirection } from "@base-ui/react/direction-provider";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { useUserLocale } from "@/hooks/useUserLocale";

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({
    profile: { needsSetup: false },
    profileLoaded: true,
    generalSetting: {},
  }),
}));

vi.mock("@/hooks/useNavigateTo", () => ({ default: () => vi.fn() }));
vi.mock("@/hooks/useUserLocale", () => ({ useUserLocale: vi.fn() }));
vi.mock("@/hooks/useUserTheme", () => ({ useUserTheme: vi.fn() }));
vi.mock("@/utils/oauth", () => ({ cleanupExpiredOAuthState: vi.fn() }));

describe("scroll restoration", () => {
  let scrollY = 0;

  beforeEach(() => {
    vi.mocked(useUserLocale).mockReturnValue("ltr");
    scrollY = 0;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollY,
    });
  });

  it("provides the active locale direction to routed content", async () => {
    vi.mocked(useUserLocale).mockReturnValue("rtl");
    const DirectionProbe = () => <div>Direction: {useDirection()}</div>;
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <App />,
          children: [{ index: true, element: <DirectionProbe /> }],
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Direction: rtl")).toBeInTheDocument();
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
