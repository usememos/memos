import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickFindDialog from "@/components/AppSidebar/QuickFindDialog";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import { getSelectedSpaceStorageKey, SpaceProvider, useSpaceContext } from "@/contexts/SpaceContext";

const state = vi.hoisted(() => ({
  currentUser: { name: "users/alice" } as { name: string } | undefined,
  spaces: [{ name: "spaces/product", title: "Product", description: "" }],
  filters: [] as Array<{ factor: "contentSearch"; value: string }>,
  setFilters: vi.fn(),
  setMemoView: vi.fn(),
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/MemoFilterContext")>();
  return {
    ...actual,
    useMemoFilterContext: () => ({
      filters: state.filters,
      memoView: undefined,
      setFilters: state.setFilters,
      setMemoView: state.setMemoView,
    }),
  };
});

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.currentUser,
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({ data: state.spaces, isSuccess: true, isPending: false, isError: false }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useMemoViews: () => ({ data: [] }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const Harness = () => {
  const location = useLocation();
  const { setQuickFindOpen } = useAppSidebar();
  const { collectionScope } = useSpaceContext();

  return (
    <>
      <output data-testid="path">{`${location.pathname}${location.search}`}</output>
      <output data-testid="scope">{collectionScope.kind === "space" ? collectionScope.name : collectionScope.kind}</output>
      <button type="button" onClick={() => setQuickFindOpen(true)}>
        Open Quick Find
      </button>
      <QuickFindDialog />
    </>
  );
};

describe("Quick Find navigation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    state.currentUser = { name: "users/alice" };
    state.spaces = [{ name: "spaces/product", title: "Product", description: "" }];
    state.filters = [];
    state.setFilters.mockClear();
    state.setMemoView.mockClear();
  });

  it("switches to All in one history step so Back returns directly to Inbox", async () => {
    const storageKey = getSelectedSpaceStorageKey("users/alice");
    sessionStorage.setItem(storageKey, "spaces/product");

    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SpaceProvider>
              <AppSidebarProvider>
                <Harness />
              </AppSidebarProvider>
            </SpaceProvider>
          ),
        },
      ],
      { initialEntries: ["/inbox"] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByTestId("scope")).toHaveTextContent("spaces/product");
    fireEvent.click(screen.getByRole("button", { name: "Open Quick Find" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "roadmap" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/?filter=contentSearch:roadmap"));
    expect(state.setFilters).toHaveBeenCalledWith([{ factor: "contentSearch", value: "roadmap" }]);
    expect(screen.getByTestId("scope")).toHaveTextContent("all");
    expect(sessionStorage.getItem(storageKey)).toBeNull();

    await act(async () => {
      await router.navigate(-1);
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
  });

  it("keeps a unique selected Space title compact in remembered-collection search", async () => {
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/alice"), "spaces/product");

    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SpaceProvider>
              <AppSidebarProvider>
                <Harness />
              </AppSidebarProvider>
            </SpaceProvider>
          ),
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Quick Find" }));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "common.search Product · common.memos");
    expect(input).toHaveAttribute("aria-label", "common.search Product · common.memos");
  });

  it("shows a UID for matching titles and compacts its UUID only in the placeholder", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    state.spaces = [
      { name: `spaces/${uuid}`, title: "Product", description: "" },
      { name: "spaces/product-roadmap", title: "Product", description: "" },
    ];
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/alice"), `spaces/${uuid}`);

    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SpaceProvider>
              <AppSidebarProvider>
                <Harness />
              </AppSidebarProvider>
            </SpaceProvider>
          ),
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Quick Find" }));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "common.search Product (123e4567…) · common.memos");
    expect(input).toHaveAttribute("aria-label", `common.search Product (${uuid}) · common.memos`);
  });

  it("preserves an anonymous global page in history", async () => {
    state.currentUser = undefined;

    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SpaceProvider>
              <AppSidebarProvider>
                <Harness />
              </AppSidebarProvider>
            </SpaceProvider>
          ),
        },
      ],
      { initialEntries: ["/about"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Quick Find" }));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "roadmap" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/?filter=contentSearch:roadmap"));

    await act(async () => {
      await router.navigate(-1);
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/about");
  });
});
