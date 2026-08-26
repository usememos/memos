import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tag } from "@/components/MemoContent/Tag";

const navigateTo = vi.hoisted(() => vi.fn());
const clearSelectedSpace = vi.hoisted(() => vi.fn());
const origin = vi.hoisted(() => ({
  parentPage: "/" as string,
  parentScope: "all" as "all" | "preserve",
}));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => navigateTo,
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => origin,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ clearSelectedSpace }),
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
    clearSelectedSpace.mockClear();
    origin.parentPage = "/";
    origin.parentScope = "all";
  });

  it("switches to All only when a global detail tag enters a collection", () => {
    render(
      <MemoryRouter initialEntries={["/memos/parent"]}>
        <Tag data-tag="work">#work</Tag>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("#work"));

    expect(clearSelectedSpace).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith("/?filter=tagSearch%3Awork");
  });

  it("returns a Profile-origin tag without clearing the remembered Space", () => {
    origin.parentPage = "/u/alice?view=map";

    render(
      <MemoryRouter initialEntries={["/memos/parent"]}>
        <Tag data-tag="work">#work</Tag>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("#work"));

    expect(clearSelectedSpace).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith("/u/alice?filter=tagSearch%3Awork");
  });
});
