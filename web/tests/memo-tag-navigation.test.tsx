import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tag } from "@/components/MemoContent/Tag";

const navigateTo = vi.hoisted(() => vi.fn());
const origin = vi.hoisted(() => ({ parentPage: "/" as string }));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => navigateTo,
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => origin,
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/MemoFilterContext")>();
  return {
    ...actual,
    useMemoFilterContext: () => ({
      getFiltersByFactor: () => [],
      removeFilter: vi.fn(),
      addFilter: vi.fn(),
    }),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userTagsSetting: undefined }),
}));

describe("Memo tag navigation", () => {
  beforeEach(() => {
    navigateTo.mockClear();
    origin.parentPage = "/";
  });

  it("navigates directly to the global collection from a global detail", () => {
    render(
      <MemoryRouter initialEntries={["/memos/parent"]}>
        <Tag data-tag="work">#work</Tag>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("#work"));
    expect(navigateTo).toHaveBeenCalledWith("/?filter=tagSearch%3Awork");
  });

  it("returns a Profile-origin tag to that profile's memo list", () => {
    origin.parentPage = "/u/alice?view=map";

    render(
      <MemoryRouter initialEntries={["/memos/parent"]}>
        <Tag data-tag="work">#work</Tag>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("#work"));
    expect(navigateTo).toHaveBeenCalledWith("/u/alice?filter=tagSearch%3Awork");
  });
});
