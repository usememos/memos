import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ColumnGrid, { ColumnGridUntrappedProvider, GRID_GAP, useColumnGridUntrapped } from "@/components/ColumnGrid";

// Regression test for #6288: an inline editor's focus mode renders position:fixed
// UI inside a grid tile. A tile positioned with a transform (or will-change:
// transform) is the containing block for fixed descendants, so the focus-mode
// surface gets trapped inside the card. The untrapped set switches those tiles
// to left/top for the duration.

interface Item {
  key: string;
}

const TileConsumer = ({ itemKey }: { itemKey: string }) => {
  const { setUntrappedKey, clearUntrappedKey } = useColumnGridUntrapped();
  return (
    <>
      <button type="button" data-testid={`untrap-${itemKey}`} onClick={() => setUntrappedKey(itemKey)}>
        untrap {itemKey}
      </button>
      <button type="button" data-testid={`clear-${itemKey}`} onClick={() => clearUntrappedKey(itemKey)}>
        clear {itemKey}
      </button>
    </>
  );
};

const renderGrid = () => {
  const items: Item[] = [{ key: "a" }, { key: "b" }];
  render(
    <ColumnGridUntrappedProvider>
      <ColumnGrid
        items={items}
        getKey={(item) => item.key}
        renderItem={(item) => (
          <div data-testid={`tile-${item.key}`}>
            <TileConsumer itemKey={item.key} />
          </div>
        )}
      />
    </ColumnGridUntrappedProvider>,
  );
};

const tileWrapper = (key: string) => screen.getByTestId(`tile-${key}`).parentElement as HTMLElement;

describe("ColumnGrid untrapped tile", () => {
  it("positions every tile with a transform by default", () => {
    renderGrid();
    for (const key of ["a", "b"]) {
      const el = tileWrapper(key);
      expect(el.style.transform).toContain("translate3d");
      expect(el.style.willChange).toBe("transform");
      expect(el.className).toContain("transition-transform");
    }
  });

  it("positions the untrapped tile with left/top so it cannot contain fixed descendants", () => {
    renderGrid();
    fireEvent.click(screen.getByTestId("untrap-b"));

    const untrapped = tileWrapper("b");
    expect(untrapped.style.transform).toBe("");
    expect(untrapped.style.willChange).toBe("");
    // jsdom reports every tile as zero-height, so the second tile's y is one gap down.
    expect(untrapped.style.left).toBe("0px");
    expect(untrapped.style.top).toBe(`${GRID_GAP}px`);
    expect(untrapped.className).not.toContain("transition-transform");

    const other = tileWrapper("a");
    expect(other.style.transform).toContain("translate3d");
    expect(other.style.willChange).toBe("transform");
  });

  it("keeps every focused tile untrapped when two editors claim focus mode", () => {
    renderGrid();
    fireEvent.click(screen.getByTestId("untrap-a"));
    fireEvent.click(screen.getByTestId("untrap-b"));

    for (const key of ["a", "b"]) {
      const el = tileWrapper(key);
      expect(el.style.transform).toBe("");
      expect(el.style.willChange).toBe("");
    }

    // Releasing one claim must not retrap the other tile.
    fireEvent.click(screen.getByTestId("clear-a"));
    expect(tileWrapper("a").style.transform).toContain("translate3d");
    expect(tileWrapper("b").style.transform).toBe("");
  });
});
