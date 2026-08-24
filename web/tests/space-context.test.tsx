import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSelectedSpaceStorageKey, SpaceProvider, useSpaceContext } from "@/contexts/SpaceContext";
import { SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const newlyCreatedSpace = create(SpaceSchema, { name: "spaces/new", title: "New", description: "" });

const state = vi.hoisted(() => ({
  currentUser: { name: "users/alice" } as { name: string } | undefined,
  query: {
    data: [] as Array<{ name: string; title: string; description: string }>,
    isSuccess: true,
    isPending: false,
    isError: false,
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.currentUser,
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => state.query,
}));

const Probe = () => {
  const { memoFilter, spaces, selectedSpace, selectedSpaceName, selectMemos, selectSpace } = useSpaceContext();
  return (
    <div>
      <output data-testid="selected-name">{selectedSpaceName ?? "Memos"}</output>
      <output data-testid="selected-title">{selectedSpace?.title ?? ""}</output>
      <output data-testid="memo-filter">{memoFilter ?? "all"}</output>
      <button type="button" onClick={selectMemos}>
        Select Memos
      </button>
      <button type="button" onClick={() => spaces[0] && selectSpace(spaces[0])}>
        Select first Space
      </button>
      <button type="button" onClick={() => selectSpace(newlyCreatedSpace)}>
        Select new Space
      </button>
      <CurrentPath />
    </div>
  );
};

const CurrentPath = () => <output data-testid="path">{useLocation().pathname}</output>;

const renderProvider = (initialPath = "/explore") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SpaceProvider>
        <Probe />
      </SpaceProvider>
    </MemoryRouter>,
  );

describe("SpaceProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    state.currentUser = { name: "users/alice" };
    state.query = { data: [], isSuccess: true, isPending: false, isError: false };
  });

  it("uses Memos when the user has no stored Space selection", () => {
    renderProvider();

    expect(screen.getByTestId("selected-name")).toHaveTextContent("Memos");
    expect(screen.getByTestId("memo-filter")).toHaveTextContent("space == null");
  });

  it("restores a valid Space and stores changes only for the current user", () => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    state.query.data = [product];
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/alice"), product.name);
    renderProvider();

    expect(screen.getByTestId("selected-name")).toHaveTextContent(product.name);
    expect(screen.getByTestId("selected-title")).toHaveTextContent("Product");
    expect(screen.getByTestId("memo-filter")).toHaveTextContent('space == "spaces/product"');

    fireEvent.click(screen.getByRole("button", { name: "Select Memos" }));
    expect(sessionStorage.getItem(getSelectedSpaceStorageKey("users/alice"))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select first Space" }));
    expect(sessionStorage.getItem(getSelectedSpaceStorageKey("users/alice"))).toBe(product.name);
  });

  it("clears a stored selection only after a successful list proves it unavailable", async () => {
    const key = getSelectedSpaceStorageKey("users/alice");
    sessionStorage.setItem(key, "spaces/removed");
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("selected-name")).toHaveTextContent("Memos"));
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("preserves a stored selection when the Space list fails transiently", () => {
    const key = getSelectedSpaceStorageKey("users/alice");
    sessionStorage.setItem(key, "spaces/product");
    state.query = { data: [], isSuccess: false, isPending: false, isError: true };
    renderProvider();

    expect(screen.getByTestId("selected-name")).toHaveTextContent("spaces/product");
    expect(sessionStorage.getItem(key)).toBe("spaces/product");
  });

  it("keeps a newly created Space selected until the refreshed list includes it", () => {
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Select new Space" }));

    expect(screen.getByTestId("selected-name")).toHaveTextContent(newlyCreatedSpace.name);
    expect(screen.getByTestId("selected-title")).toHaveTextContent(newlyCreatedSpace.title);
    expect(screen.getByTestId("memo-filter")).toHaveTextContent('space == "spaces/new"');
    expect(sessionStorage.getItem(getSelectedSpaceStorageKey("users/alice"))).toBe(newlyCreatedSpace.name);
  });

  it("lands on the context's feed when switching to a Space", () => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    state.query.data = [product];
    renderProvider("/archived");

    expect(screen.getByTestId("path")).toHaveTextContent("/archived");

    fireEvent.click(screen.getByRole("button", { name: "Select first Space" }));

    expect(screen.getByTestId("selected-name")).toHaveTextContent(product.name);
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });

  it("returns to the Memos feed when leaving a Space, even from another route", () => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    state.query.data = [product];
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/alice"), product.name);
    renderProvider("/explore");

    fireEvent.click(screen.getByRole("button", { name: "Select Memos" }));

    expect(screen.getByTestId("selected-name")).toHaveTextContent("Memos");
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });

  it("isolates the active selection across account changes", () => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    const personal = { name: "spaces/personal", title: "Personal", description: "" };
    state.query.data = [product, personal];
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/alice"), product.name);
    sessionStorage.setItem(getSelectedSpaceStorageKey("users/bob"), personal.name);
    const view = renderProvider();

    expect(screen.getByTestId("selected-name")).toHaveTextContent(product.name);

    state.currentUser = { name: "users/bob" };
    view.rerender(
      <MemoryRouter initialEntries={["/explore"]}>
        <SpaceProvider>
          <Probe />
        </SpaceProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("selected-name")).toHaveTextContent(personal.name);
  });
});
