import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BentoGrid from "@/components/BentoGrid";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

// jsdom has no layout engine (clientWidth is 0), so the grid keeps its initial layout
// (measured from Infinity → as many columns as possible). These assert render structure,
// not packing — same tradeoff as tests/column-grid.test.tsx.
const buildMemo = (overrides: MessageInitShape<typeof MemoSchema> = {}) =>
  create(MemoSchema, { name: "memos/main", content: "hello", attachments: [], ...overrides });

const getKey = (memo: { name: string }) => memo.name;

const tileOf = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLElement>("div[style*='grid-column']")].find(
    (el) => el.style.gridColumn && el.querySelector(`[data-name="${name}"]`),
  );

const namedCard = (memo: ReturnType<typeof buildMemo>) => <div data-name={memo.name} />;

describe("<BentoGrid>", () => {
  it("renders one tile per item with dense auto-flow", () => {
    const { container } = render(
      <BentoGrid items={[buildMemo({ name: "memos/a" }), buildMemo({ name: "memos/b" })]} getKey={getKey} renderItem={namedCard} />,
    );

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridAutoFlow).toBe("dense");
    expect(grid.querySelectorAll("[data-name]")).toHaveLength(2);
  });

  it("renders the leading node as a full-width first row", () => {
    const { container, getByTestId } = render(
      <BentoGrid items={[buildMemo()]} getKey={getKey} renderItem={namedCard} leading={<div data-testid="composer" />} />,
    );

    expect(getByTestId("composer")).toBeInTheDocument();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.firstElementChild instanceof HTMLElement && grid.firstElementChild.style.gridColumn).toBe("1 / -1");
  });

  it("spans pinned memos across two columns", () => {
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(532);
    try {
      const pinned = buildMemo({ name: "memos/pinned", pinned: true });
      const plain = buildMemo({ name: "memos/plain" });
      const { container } = render(<BentoGrid items={[plain, pinned]} getKey={getKey} renderItem={namedCard} />);

      expect(tileOf(container, "memos/pinned")?.style.gridColumn).toBe("span 2");
      expect(tileOf(container, "memos/plain")?.style.gridColumn).toBe("span 1");
    } finally {
      clientWidth.mockRestore();
    }
  });

  it("renders the priority item first", () => {
    const first = buildMemo({ name: "memos/first" });
    const second = buildMemo({ name: "memos/second" });
    const { container } = render(<BentoGrid items={[first, second]} getKey={getKey} renderItem={namedCard} priorityKey="memos/second" />);

    const tiles = [...container.querySelectorAll<HTMLElement>("[data-name]")];
    expect(tiles[0]).toHaveAttribute("data-name", "memos/second");
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<BentoGrid items={[]} getKey={getKey} renderItem={namedCard} />);
    expect(container.firstElementChild?.children).toHaveLength(0);
  });

  it("updates the column ceiling from the measured width", () => {
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(532);

    const { container } = render(
      <BentoGrid items={[buildMemo()]} getKey={getKey} renderItem={namedCard} maxColumns={0} maxColumnWidth={420} />,
    );

    // 532px fits 2 columns at the 260px minimum (plus 12px gap).
    expect((container.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");

    clientWidth.mockRestore();
  });
});
