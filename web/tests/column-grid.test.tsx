import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ColumnGrid from "@/components/ColumnGrid";

// jsdom has no layout engine (offsetHeight/clientWidth are 0) and no ResizeObserver,
// both of which ColumnGrid guards for — so these assert render structure, not positioning.
interface Item {
  id: string;
}

const item = (id: string): Item => ({ id });
const getKey = (i: Item) => i.id;

describe("<ColumnGrid>", () => {
  it("renders one card per item", () => {
    const { container } = render(
      <ColumnGrid items={[item("a"), item("b"), item("c")]} getKey={getKey} renderItem={(i) => <div data-testid="card">{i.id}</div>} />,
    );

    expect(container.querySelectorAll('[data-testid="card"]')).toHaveLength(3);
  });

  it("renders the leading node as the first tile, before the items", () => {
    const { container, getByTestId } = render(
      <ColumnGrid
        items={[item("a")]}
        getKey={getKey}
        renderItem={(i) => <div data-testid={`card-${i.id}`}>{i.id}</div>}
        leading={<div data-testid="composer" />}
      />,
    );

    expect(getByTestId("composer")).toBeInTheDocument();
    // The grid is the container's only child; its first wrapper holds the leading node.
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.children[0].querySelector('[data-testid="composer"]')).not.toBeNull();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<ColumnGrid items={[]} getKey={getKey} renderItem={() => <div data-testid="card" />} />);

    expect(container.querySelectorAll('[data-testid="card"]')).toHaveLength(0);
  });
});
