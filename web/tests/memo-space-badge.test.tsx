import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoSpaceBadge from "@/components/MemoView/components/MemoSpaceBadge";

const state = vi.hoisted(() => ({
  spaces: [] as Array<{ name: string; title: string }>,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => {
    const duplicateSpaceTitles = new Set(
      state.spaces
        .filter((space, index) => state.spaces.findIndex((candidate) => candidate.title === space.title) !== index)
        .map((space) => space.title),
    );
    return {
      duplicateSpaceTitles,
      spaceByName: new Map(state.spaces.map((space) => [space.name, space])),
    };
  },
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

    expect(screen.getByTitle("Space: Product")).toHaveTextContent("Product");
    expect(screen.getByTitle("Space: Product")).not.toHaveTextContent("product");
  });

  it("uses the shared pill presentation", () => {
    state.spaces = [{ name: "spaces/product", title: "Product" }];
    render(<MemoSpaceBadge spaceName="spaces/product" />);

    const badge = screen.getByTitle("Space: Product");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge.querySelector(".lucide-astroid")).not.toBeNull();
  });

  it("truncates a long title on one line while preserving its full value", () => {
    const longTitle = "A very long product research and planning space title";
    state.spaces = [{ name: "spaces/product", title: longTitle }];
    render(<MemoSpaceBadge spaceName="spaces/product" />);

    const badge = screen.getByTitle(`Space: ${longTitle}`);
    expect(badge).toHaveClass("max-w-36", "sm:max-w-48");
    expect(screen.getByText(longTitle)).toHaveClass("min-w-0", "flex-1", "truncate");
  });

  it("adds the full custom UID when known Space titles match", () => {
    state.spaces = [
      { name: "spaces/product-notes", title: "Product" },
      { name: "spaces/product-roadmap", title: "Product" },
    ];
    render(<MemoSpaceBadge spaceName="spaces/product-notes" />);

    const badge = screen.getByTitle("Space: Product (product-notes)");
    expect(badge).toHaveClass("max-w-52", "sm:max-w-64");
    expect(badge).toHaveTextContent("Product · product-notes");
    expect(badge.querySelector(".font-mono")).toHaveClass("max-w-[48%]", "shrink-0", "truncate");
  });

  it("shows eight UUID characters while preserving the full ID in the accessible label", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    state.spaces = [
      { name: `spaces/${uuid}`, title: "Product" },
      { name: "spaces/product-roadmap", title: "Product" },
    ];
    render(<MemoSpaceBadge spaceName={`spaces/${uuid}`} />);

    expect(screen.getByTitle(`Space: Product (${uuid})`)).toHaveTextContent("Product · 123e4567…");
  });

  it("keeps both ends of long custom UIDs visible", () => {
    state.spaces = [
      { name: "spaces/customer-support-production", title: "Product" },
      { name: "spaces/customer-support-development", title: "Product" },
    ];
    render(<MemoSpaceBadge spaceName="spaces/customer-support-production" />);

    expect(screen.getByTitle("Space: Product (customer-support-production)")).toHaveTextContent("Product · customer…uction");
  });

  it("uses a neutral title while still exposing an unknown Space UID", () => {
    render(<MemoSpaceBadge spaceName="spaces/private" />);

    expect(screen.getByTitle("Space (private)")).toHaveTextContent("Space · private");
    expect(screen.queryByText("spaces/private")).not.toBeInTheDocument();
  });

  it("omits placement for an unassigned memo", () => {
    const { container } = render(<MemoSpaceBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
