import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Bookmarks from "@/pages/Bookmarks";

const state = vi.hoisted(() => ({
  spaceFilter: undefined as string | undefined,
  listProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: (props: Record<string, unknown>) => {
    state.listProps.push(props);
    return <div data-testid="list" />;
  },
}));
vi.mock("@/components/MemoView", () => ({ default: () => <div /> }));
vi.mock("@/components/BookmarksImport/BookmarksImportDialog", () => ({ default: () => <div /> }));
vi.mock("@/hooks", () => ({
  useMemoFilters: () => "creator_filter",
  useMemoSorting: () => ({ listSort: undefined, orderBy: undefined }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/u1" }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ memoFilter: state.spaceFilter }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Bookmarks />
    </MemoryRouter>,
  );

describe("<Bookmarks>", () => {
  beforeEach(() => {
    state.spaceFilter = undefined;
    state.listProps = [];
  });

  it("feeds only link memos via the has_link filter", () => {
    renderPage();

    expect(state.listProps[0]?.contextFilter).toBe("(has_link)");
  });

  it("combines has_link with the remembered Space scope", () => {
    state.spaceFilter = 'space == "spaces/s1"';
    renderPage();

    expect(state.listProps[0]?.contextFilter).toBe('(has_link) && (space == "spaces/s1")');
  });

  it("threads the card variant through the renderer", () => {
    renderPage();

    const renderer = state.listProps[0]?.renderer as (memo: unknown, options: { variant: string }) => unknown;
    expect(renderer).toBeTypeOf("function");
  });
});
