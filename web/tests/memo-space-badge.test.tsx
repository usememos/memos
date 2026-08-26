import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoSpaceBadge from "@/components/MemoView/components/MemoSpaceBadge";

const state = vi.hoisted(() => ({
  spaces: [] as Array<{ name: string; title: string }>,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ spaces: state.spaces }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => (key === "space.current" ? "Space" : key),
}));

describe("MemoSpaceBadge", () => {
  beforeEach(() => {
    state.spaces = [];
  });

  it("shows the title of a known Space", () => {
    state.spaces = [{ name: "spaces/product", title: "Product" }];
    render(<MemoSpaceBadge spaceName="spaces/product" />);

    expect(screen.getByTitle("Space: Product")).toHaveTextContent("Space: Product");
  });

  it("uses the shared pill presentation", () => {
    state.spaces = [{ name: "spaces/product", title: "Product" }];
    render(<MemoSpaceBadge spaceName="spaces/product" />);

    const badge = screen.getByTitle("Space: Product");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge.querySelector(".lucide-user-lock")).not.toBeNull();
  });

  it("uses a neutral label rather than fetching or exposing an unknown Space", () => {
    render(<MemoSpaceBadge spaceName="spaces/private" />);

    expect(screen.getByTitle("Space")).toHaveTextContent("Space");
    expect(screen.queryByText("spaces/private")).not.toBeInTheDocument();
  });

  it("omits placement for an unassigned memo", () => {
    const { container } = render(<MemoSpaceBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
