import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NavigationPage from "@/modules/navigation/NavigationPage";

const rpc = vi.hoisted(() => ({
  listMemos: vi.fn(),
  createMemo: vi.fn(),
  updateMemo: vi.fn(),
  deleteMemo: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    listMemos: rpc.listMemos,
    createMemo: rpc.createMemo,
    updateMemo: rpc.updateMemo,
    deleteMemo: rpc.deleteMemo,
  },
}));

vi.mock("@/modules/navigation/i18n", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/navigation/i18n")>();
  return { ...mod, useNavStrings: () => mod.navStrings("en") };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NavigationPage />
    </QueryClientProvider>,
  );

const searchInput = () => screen.getByTestId("nav-search-input");

const seedFirstVisit = () => {
  rpc.listMemos.mockResolvedValue({ memos: [] });
  rpc.createMemo.mockResolvedValue({ name: "memos/seed" });
  rpc.updateMemo.mockResolvedValue({ name: "memos/seed" });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("NavigationPage empty and error states", () => {
  it("seeds the default wall on first visit and marks the search region", async () => {
    seedFirstVisit();
    renderPage();

    expect(screen.getByText("Loading navigation config…")).toBeInTheDocument();

    expect(await screen.findAllByTestId("nav-card")).toHaveLength(3);
    expect(screen.getByRole("search")).toContainElement(searchInput());
    expect(screen.getByText("Memos")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("shows the reset empty state for a broken memo with no cache", async () => {
    rpc.listMemos.mockResolvedValue({ memos: [{ name: "memos/broken", content: "nav-config:v1\n```json\nnot json\n```" }] });
    renderPage();

    expect(await screen.findByText("No cards yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeInTheDocument();
  });

  it("shows a retry state when the RPC fails with no cache", async () => {
    rpc.listMemos.mockRejectedValue(new Error("offline"));
    renderPage();

    expect(await screen.findByText("Offline cache")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("NavigationPage search and keyboard interaction", () => {
  beforeEach(seedFirstVisit);

  it("filters cards and drops groups with no match", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.change(searchInput(), { target: { value: "github" } });

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Memos")).not.toBeInTheDocument();
    expect(screen.queryByText("MDN")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("nav-group")).toHaveLength(1);
  });

  it("shows the empty result state and restores cards on clear", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.change(searchInput(), { target: { value: "definitely-not-here" } });

    const empty = await screen.findByTestId("nav-search-empty");
    expect(empty).toHaveTextContent("No matching cards");
    expect(screen.queryAllByTestId("nav-card")).toHaveLength(0);

    fireEvent.click(within(empty).getByRole("button", { name: "Clear search" }));

    expect(screen.getByText("Memos")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("focuses the search box on /", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.keyDown(document, { key: "/" });

    expect(document.activeElement).toBe(searchInput());
  });

  it("moves the roving highlight with the arrow keys", async () => {
    renderPage();
    const card = await screen.findByText("Memos");

    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });

    expect(card.closest("a")).toHaveAttribute("data-active", "true");
  });

  it("wraps ArrowUp to the last card when nothing is active", async () => {
    renderPage();
    const last = await screen.findByText("MDN");

    fireEvent.keyDown(searchInput(), { key: "ArrowUp" });

    expect(last.closest("a")).toHaveAttribute("data-active", "true");
  });

  it("clears the query on Escape", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.change(searchInput(), { target: { value: "github" } });
    expect(searchInput()).toHaveValue("github");

    fireEvent.keyDown(searchInput(), { key: "Escape" });

    expect(searchInput()).toHaveValue("");
    expect(screen.getByText("Memos")).toBeInTheDocument();
  });

  it("clears the roving highlight when focus leaves the card list", async () => {
    renderPage();
    const card = await screen.findByText("Memos");

    fireEvent.focus(card.closest("a")!);
    expect(card.closest("a")).toHaveAttribute("data-active", "true");

    fireEvent.blur(card.closest("a")!, { relatedTarget: searchInput() });
    expect(card.closest("a")).not.toHaveAttribute("data-active");
  });
});

describe("NavigationPage group disclosure", () => {
  beforeEach(seedFirstVisit);

  it("labels each group toggle with its collapse action", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    const toggle = screen.getAllByRole("button", { name: /Collapse/ })[0];
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    await waitFor(() => {
      const updated = screen.getAllByRole("button", { name: /Expand/ })[0];
      expect(updated).toHaveAttribute("aria-expanded", "false");
    });
  });
});

describe("NavigationPage editor", () => {
  beforeEach(seedFirstVisit);

  it("adds a card through the create dialog", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");
    const before = screen.getAllByTestId("nav-card").length;

    fireEvent.click(screen.getAllByTestId("nav-add-card")[0]);
    fireEvent.change(screen.getByTestId("nav-card-title"), { target: { value: "Example" } });
    fireEvent.change(screen.getByTestId("nav-card-url"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("nav-card-submit"));

    await waitFor(() => {
      expect(screen.getAllByTestId("nav-card")).toHaveLength(before + 1);
    });
    expect(screen.getByText("Example")).toBeInTheDocument();
  });

  it("rejects an invalid URL inside the create dialog", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.click(screen.getAllByTestId("nav-add-card")[0]);
    fireEvent.change(screen.getByTestId("nav-card-title"), { target: { value: "Bad" } });
    fireEvent.change(screen.getByTestId("nav-card-url"), { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByTestId("nav-card-submit"));

    expect(await screen.findByTestId("nav-card-error")).toHaveTextContent("valid http(s)");
  });

  it("renames a card through the edit dialog", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");

    fireEvent.click(screen.getAllByTestId("nav-card-edit")[0]);
    fireEvent.change(screen.getByTestId("nav-card-title"), { target: { value: "Memos Docs" } });
    fireEvent.click(screen.getByTestId("nav-card-submit"));

    await waitFor(() => {
      expect(screen.getByText("Memos Docs")).toBeInTheDocument();
    });
  });

  it("deletes a card after confirmation", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");
    const before = screen.getAllByTestId("nav-card").length;

    fireEvent.click(screen.getAllByTestId("nav-card-delete")[0]);
    fireEvent.click(screen.getByTestId("nav-confirm-delete"));

    await waitFor(() => {
      expect(screen.getAllByTestId("nav-card")).toHaveLength(before - 1);
    });
  });

  it("adds a group through the header dialog", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");
    const before = screen.getAllByTestId("nav-group").length;

    fireEvent.click(screen.getByTestId("nav-add-group"));
    fireEvent.change(screen.getByTestId("nav-group-name"), { target: { value: "工具" } });
    fireEvent.click(screen.getByTestId("nav-name-submit"));

    await waitFor(() => {
      expect(screen.getAllByTestId("nav-group")).toHaveLength(before + 1);
    });
    expect(screen.getByText("工具")).toBeInTheDocument();
  });

  it("deletes a group after confirmation", async () => {
    renderPage();
    await screen.findAllByTestId("nav-card");
    const before = screen.getAllByTestId("nav-group").length;

    fireEvent.click(screen.getAllByTestId("nav-delete-group")[0]);
    fireEvent.click(screen.getByTestId("nav-confirm-delete"));

    await waitFor(() => {
      expect(screen.getAllByTestId("nav-group")).toHaveLength(before - 1);
    });
  });
});
