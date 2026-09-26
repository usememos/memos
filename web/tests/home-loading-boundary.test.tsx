import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

vi.mock("@/hooks/useMemoSuggestions", () => ({
  useMemoSuggestions: () => [{ id: "tag:work" }],
}));

const state = vi.hoisted(() => ({
  selectedSpaceName: undefined as string | undefined,
  creatorUsername: undefined as string | undefined,
  editorProps: undefined as Record<string, unknown> | undefined,
  listProps: undefined as Record<string, unknown> | undefined,
  memoViewProps: undefined as Record<string, unknown> | undefined,
  filterOptions: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: (props: Record<string, unknown>) => {
    state.editorProps = props;
    return <div data-testid="memo-editor" />;
  },
}));

vi.mock("@/components/MemoView", () => ({
  default: (props: Record<string, unknown>) => {
    state.memoViewProps = props;
    return <div data-testid="memo-view" />;
  },
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: ({
    renderer,
    renderLeading,
    ...props
  }: {
    renderer: (memo: { name: string }, options: { compact: boolean }) => React.ReactNode;
    renderLeading: (options: { useGrid: boolean }) => React.ReactNode;
  } & Record<string, unknown>) => {
    state.listProps = props;
    return (
      <>
        {renderLeading({ useGrid: false })}
        {renderer({ name: "memos/1" }, { compact: false })}
      </>
    );
  },
  getMemoKey: (memo: { name: string }) => memo.name,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: true }),
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => ({ claimHomeAutoFocus: () => true }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: [] }),
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  NewMemoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({
    selectedSpaceName: state.selectedSpaceName,
    creatorUsername: state.creatorUsername,
    memoFilter:
      [
        state.selectedSpaceName && `space == "${state.selectedSpaceName}"`,
        state.creatorUsername && `creator == "users/${state.creatorUsername}"`,
      ]
        .filter(Boolean)
        .join(" && ") || undefined,
  }),
}));

vi.mock("@/hooks", () => ({
  useMemoFilters: (options: Record<string, unknown>) => {
    state.filterOptions = options;
    return "";
  },
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/steven", username: "steven" }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<Home>", () => {
  beforeEach(() => {
    state.selectedSpaceName = undefined;
    state.creatorUsername = undefined;
    state.editorProps = undefined;
    state.listProps = undefined;
    state.memoViewProps = undefined;
    state.filterOptions = undefined;
  });
  it("renders the editor and memo cards synchronously without blank placeholders", () => {
    render(<Home />);

    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
    expect(state.listProps).toMatchObject({ contextFilter: undefined });
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor", defaultSpace: undefined });
    expect(state.editorProps?.autoFocus).toEqual(expect.any(Function));
    expect(state.editorProps?.suggestions).toEqual([{ id: "tag:work" }]);
    expect(state.filterOptions).not.toHaveProperty("creatorName");
    expect(state.memoViewProps).toMatchObject({ showCreator: true });
  });

  it("shows another creator's matching memos without offering an editor", () => {
    state.creatorUsername = "alice";
    render(<Home />);
    expect(state.listProps).toMatchObject({ contextFilter: 'creator == "users/alice"' });
    expect(state.memoViewProps).toMatchObject({ showCreator: false });
    expect(screen.queryByTestId("memo-editor")).not.toBeInTheDocument();
  });

  it("filters the feed and sets new memo placement to the selected Space", () => {
    state.selectedSpaceName = "spaces/product";
    render(<Home />);

    expect(state.listProps).toMatchObject({ contextFilter: 'space == "spaces/product"' });
    expect(state.editorProps).toMatchObject({
      cacheKey: "home-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });
  });
});
