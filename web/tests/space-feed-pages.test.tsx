import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Archived from "@/pages/Archived";

const state = vi.hoisted(() => ({
  listProps: undefined as Record<string, unknown> | undefined,
  memoViewProps: undefined as Record<string, unknown> | undefined,
  filterOptions: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/components/MemoView", () => ({
  default: (props: Record<string, unknown>) => {
    state.memoViewProps = props;
    return <div />;
  },
}));
vi.mock("@/components/PagedMemoList", () => ({
  default: (props: Record<string, unknown>) => {
    state.listProps = props;
    const renderLeading = props.renderLeading as (options: { useGrid: boolean }) => React.ReactNode;
    const renderer = props.renderer as (memo: { name: string }, options: { compact: boolean }) => React.ReactNode;
    return (
      <div>
        {renderLeading({ useGrid: false })}
        {renderer({ name: "memos/test" }, { compact: false })}
      </div>
    );
  },
  getMemoKey: (memo: { name: string }) => memo.name,
}));
vi.mock("@/hooks", () => ({
  useMemoFilters: (options: Record<string, unknown>) => {
    state.filterOptions = options;
    return "filter";
  },
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("Archived feed", () => {
  it("stays limited to the signed-in creator and does not inherit Space", () => {
    render(<Archived />);
    expect(state.listProps).not.toHaveProperty("contextFilter");
    expect(state.filterOptions).toMatchObject({ creatorName: "users/test" });
    expect(state.memoViewProps).toMatchObject({ showSpace: true });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("common.archived");
  });
});
