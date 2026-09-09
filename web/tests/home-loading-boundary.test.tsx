import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

const state = vi.hoisted(() => ({
  selectedSpaceName: undefined as string | undefined,
  editorProps: undefined as Record<string, unknown> | undefined,
  listProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: (props: Record<string, unknown>) => {
    state.editorProps = props;
    return <div data-testid="memo-editor" />;
  },
}));

vi.mock("@/components/MemoView", () => ({
  default: () => <div data-testid="memo-view" />,
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
    memoFilter: state.selectedSpaceName ? `space == "${state.selectedSpaceName}"` : undefined,
  }),
}));

vi.mock("@/hooks", () => ({
  useMemoFilters: () => "",
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/1" }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<Home>", () => {
  it("renders the editor and memo cards synchronously without blank placeholders", () => {
    state.selectedSpaceName = undefined;
    render(<Home />);

    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
    expect(state.listProps).toMatchObject({ contextFilter: undefined });
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor", defaultSpace: undefined });
    expect(state.editorProps?.autoFocus).toEqual(expect.any(Function));
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
