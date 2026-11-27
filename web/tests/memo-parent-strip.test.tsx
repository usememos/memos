import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoParentStripView from "@/components/MemoView/components/MemoParentStripView";

const state = vi.hoisted(() => ({
  near: true,
  lookup: { data: undefined, isUnavailable: false, isLoading: true, error: null } as {
    data: unknown;
    isUnavailable: boolean;
    isLoading: boolean;
    error: unknown;
  },
  tagsSetting: undefined as unknown,
  useMemoLookup: vi.fn(),
}));

vi.mock("@/hooks/useMemoQueries", () => ({
  useMemoLookup: (name: string, options: { enabled: boolean }) => {
    state.useMemoLookup(name, options);
    return state.lookup;
  },
}));
vi.mock("@/hooks/useNearViewport", () => ({ useNearViewport: () => ({ ref: { current: null }, isNearViewport: state.near }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: state.tagsSetting }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({ memo: { name: "memos/child", parent: "memos/parent" }, parentPage: "/explore?filter=tagSearch%3Awork" }),
}));

const parent = (overrides: Record<string, unknown> = {}) => ({
  name: "memos/parent",
  content: "# Roadmap\n\nThree themes for the quarter.",
  snippet: "Roadmap Three themes for the quarter.",
  tags: [] as string[],
  property: { title: "Roadmap" },
  ...overrides,
});

const renderStrip = () =>
  render(
    <MemoryRouter>
      <MemoParentStripView />
    </MemoryRouter>,
  );

describe("<MemoParentStripView>", () => {
  beforeEach(() => {
    state.near = true;
    state.tagsSetting = undefined;
    state.lookup = { data: undefined, isUnavailable: false, isLoading: true, error: null };
    state.useMemoLookup.mockReset();
  });

  it("names the parent by its title and links to it at this comment", () => {
    state.lookup = { data: parent(), isUnavailable: false, isLoading: false, error: null };
    renderStrip();

    const link = screen.getByRole("link", { name: "memo.parent-memo: Roadmap" });
    expect(link).toHaveAttribute("href", "/memos/parent#child");
    expect(link).toHaveTextContent("Roadmap");
    expect(link).toHaveAttribute("title", "Roadmap");
    expect(link.querySelector(".lucide-corner-up-left")).toHaveClass("mu-icon-sm");
    expect(state.useMemoLookup).toHaveBeenCalledWith("memos/parent", { enabled: true });
  });

  it("falls back to the start of the parent's text on one line when it has no title", () => {
    state.lookup = {
      data: parent({ property: undefined, snippet: "Could we move the\n  weekly review to Thursday?" }),
      isUnavailable: false,
      isLoading: false,
      error: null,
    };
    renderStrip();

    expect(screen.getByRole("link")).toHaveTextContent("Could we move the weekly review to Thursday?");
  });

  it("names a parent whose tags blur it without quoting it", () => {
    state.tagsSetting = { tags: { secret: { blurContent: true } } };
    state.lookup = { data: parent({ tags: ["secret"] }), isUnavailable: false, isLoading: false, error: null };
    renderStrip();

    const link = screen.getByRole("link", { name: "memo.parent-memo" });
    expect(link).toHaveTextContent("memo.parent-memo");
    expect(link).not.toHaveTextContent("Roadmap");
  });

  it("holds the row with a placeholder while the parent loads, and waits for the card to come near", () => {
    state.near = false;
    renderStrip();

    expect(screen.getByRole("status", { name: "memo.parent-loading" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(state.useMemoLookup).toHaveBeenCalledWith("memos/parent", { enabled: false });
  });

  it.each([
    ["the parent is unavailable", { data: undefined, isUnavailable: true, isLoading: false, error: null }],
    ["the lookup failed", { data: undefined, isUnavailable: false, isLoading: false, error: new Error("offline") }],
  ])("says so without a link when %s", (_case, lookup) => {
    state.lookup = lookup;
    renderStrip();

    expect(screen.getByText("memo.parent-unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-circle-slash")).toBeInTheDocument();
  });
});
