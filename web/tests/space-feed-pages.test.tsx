import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Archived from "@/pages/Archived";
import Explore from "@/pages/Explore";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const state = vi.hoisted(() => ({
  selectedSpaceName: undefined as string | undefined,
  memoFilter: "space == null" as string | undefined,
  listProps: [] as Array<Record<string, unknown>>,
  filterOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/MemoView", () => ({
  default: () => <div />,
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: (props: Record<string, unknown>) => {
    state.listProps.push(props);
    return <div />;
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
    state.memoFilter = "space == null";
    state.listProps = [];
    state.filterOptions = [];
  });

  it("uses the no-Space filter for Memos Explore and Archived", () => {
    render(
      <>
        <Explore />
        <Archived />
      </>,
    );

    expect(state.listProps).toHaveLength(2);
    expect(state.listProps[0]).toMatchObject({ contextFilter: "space == null" });
    expect(state.listProps[1]).toMatchObject({ contextFilter: "space == null" });
  });

  it("uses the selected Space filter and includes its member audience in Explore", () => {
    state.selectedSpaceName = "spaces/product";
    state.memoFilter = 'space == "spaces/product"';
    render(<Explore />);

    expect(state.listProps[0]).toMatchObject({ contextFilter: 'space == "spaces/product"' });
    expect(state.filterOptions[0]).toMatchObject({
      visibilities: [Visibility.PUBLIC, Visibility.PROTECTED, Visibility.SPACE],
    });
  });
});
