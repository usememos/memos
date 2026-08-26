import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Archived from "@/pages/Archived";
import Explore from "@/pages/Explore";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const state = vi.hoisted(() => ({
  selectedSpaceName: undefined as string | undefined,
  memoFilter: undefined as string | undefined,
  listProps: [] as Array<Record<string, unknown>>,
  memoViewProps: [] as Array<Record<string, unknown>>,
  filterOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/MemoView", () => ({
  default: (props: Record<string, unknown>) => {
    state.memoViewProps.push(props);
    return <div />;
  },
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: (props: Record<string, unknown>) => {
    state.listProps.push(props);
    const renderer = props.renderer as
      | ((memo: { name: string; space: string }, options: { compact: boolean }) => React.ReactNode)
      | undefined;
    return <div>{renderer?.({ name: "memos/test", space: "spaces/product" }, { compact: false })}</div>;
  },
  getMemoKey: (memo: { name: string }) => memo.name,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectedSpaceName: state.selectedSpaceName, memoFilter: state.memoFilter }),
}));

vi.mock("@/hooks", () => ({
  useMemoFilters: (options: Record<string, unknown>) => {
    state.filterOptions.push(options);
    return "filter";
  },
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test" }),
}));

describe("Space-scoped feed pages", () => {
  beforeEach(() => {
    state.selectedSpaceName = undefined;
    state.memoFilter = undefined;
    state.listProps = [];
    state.memoViewProps = [];
    state.filterOptions = [];
  });

  it("uses the All collection without a Space filter for Explore and Archived", () => {
    render(
      <>
        <Explore />
        <Archived />
      </>,
    );

    expect(state.listProps).toHaveLength(2);
    expect(state.listProps[0]).toMatchObject({ contextFilter: undefined });
    expect(state.listProps[1]).toMatchObject({ contextFilter: undefined });
    expect(state.filterOptions[0]).toMatchObject({
      visibilities: [Visibility.PUBLIC, Visibility.PROTECTED, Visibility.SPACE],
    });
    expect(state.memoViewProps).toEqual([expect.objectContaining({ showSpace: true }), expect.objectContaining({ showSpace: true })]);
  });

  it("uses the selected Space filter and includes its member audience in Explore", () => {
    state.selectedSpaceName = "spaces/product";
    state.memoFilter = 'space == "spaces/product"';
    render(<Explore />);

    expect(state.listProps[0]).toMatchObject({ contextFilter: 'space == "spaces/product"' });
    expect(state.filterOptions[0]).toMatchObject({
      visibilities: [Visibility.PUBLIC, Visibility.PROTECTED, Visibility.SPACE],
    });
    expect(state.memoViewProps[0]).toMatchObject({ showSpace: false });
  });
});
