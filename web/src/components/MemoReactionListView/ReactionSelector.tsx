import { Button, Combobox, Popover, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import { type ReactElement, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { findEmoji } from "@/lib/emoji";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  trigger?: ReactElement;
}

const COLUMNS = 8;
const OVERSCAN = 2;

interface EmojiGridProps {
  searchRef: RefObject<HTMLInputElement | null>;
  hasReacted: (emoji: string) => boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function EmojiGrid({ searchRef, hasReacted, onSelect, onClose }: EmojiGridProps) {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const [scrollRow, setScrollRow] = useState(0);
  const [highlightedRow, setHighlightedRow] = useState<number>();
  const [layout, setLayout] = useState({ rowSize: 34, height: 240, padding: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => findEmoji(query), [query]);
  const selected = useMemo(() => options.filter(({ emoji }) => hasReacted(emoji)), [options, hasReacted]);
  const rowCount = Math.ceil(options.length / COLUMNS);
  const windowSize = Math.ceil(layout.height / layout.rowSize) + OVERSCAN * 2;
  const start = Math.max(0, Math.min(scrollRow - OVERSCAN, rowCount - windowSize));
  const rows = new Set(Array.from({ length: Math.min(windowSize, rowCount) }, (_, index) => start + index));
  // Keep the active cell and its neighbors mounted when a pointer scrolls away from it.
  if (highlightedRow !== undefined) {
    for (let row = highlightedRow - 1; row <= highlightedRow + 1; row++) {
      if (row >= 0 && row < rowCount) rows.add(row);
    }
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const row = list.querySelector<HTMLElement>('[role="row"]');
      const height = row?.getBoundingClientRect().height ?? 0;
      const rowSize = height > 0 && row ? height + Number.parseFloat(getComputedStyle(row).rowGap) : 34;
      const next = {
        rowSize,
        height: list.clientHeight || 240,
        padding: Number.parseFloat(getComputedStyle(list).paddingTop) || 0,
      };
      setLayout((previous) =>
        previous.rowSize === next.rowSize && previous.height === next.height && previous.padding === next.padding ? previous : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <Combobox.Root
      items={options}
      filter={null}
      inline
      grid
      virtualized
      autoHighlight
      multiple
      value={selected}
      itemToStringLabel={(item) => item.name}
      inputValue={query}
      onInputValueChange={(next, { reason }) => {
        if (reason !== "input-change" && reason !== "input-clear") return;
        setQuery(next);
        setScrollRow(0);
        setHighlightedRow(undefined);
        if (listRef.current) listRef.current.scrollTop = 0;
      }}
      onItemHighlighted={(_, { index, reason }) => {
        const row = index >= 0 ? Math.floor(index / COLUMNS) : undefined;
        setHighlightedRow(row);
        const list = listRef.current;
        if (!list || row === undefined || reason === "pointer") return;
        const top = row * layout.rowSize;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (top + layout.rowSize > list.scrollTop + layout.height - layout.padding * 2) {
          list.scrollTop = top + layout.rowSize - layout.height + layout.padding * 2;
        }
        setScrollRow(Math.floor(list.scrollTop / layout.rowSize));
      }}
      onOpenChange={(next, { reason }) => {
        if (!next && reason === "escape-key") onClose();
      }}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <Combobox.Input ref={searchRef} aria-label={t("space.icon.search-emoji")} placeholder={t("space.icon.search-emoji")} />
        <Combobox.List
          ref={listRef}
          aria-label={t("space.icon.emoji")}
          aria-rowcount={rowCount}
          aria-colcount={COLUMNS}
          className="h-60 p-0"
          onScroll={(event) => setScrollRow(Math.floor(event.currentTarget.scrollTop / layout.rowSize))}
        >
          <Combobox.Empty>{t("space.icon.no-results")}</Combobox.Empty>
          <div role="presentation" className="relative" style={{ height: rowCount * layout.rowSize }}>
            {Array.from(rows)
              .sort((a, b) => a - b)
              .map((rowIndex) => (
                <Combobox.Row
                  key={rowIndex}
                  aria-rowindex={rowIndex + 1}
                  className="absolute inset-x-0 grid"
                  style={{ top: rowIndex * layout.rowSize, marginTop: 0, gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
                >
                  {options.slice(rowIndex * COLUMNS, (rowIndex + 1) * COLUMNS).map((option, columnIndex) => (
                    <Combobox.Item
                      key={option.emoji}
                      value={option}
                      index={rowIndex * COLUMNS + columnIndex}
                      aria-colindex={columnIndex + 1}
                      aria-label={option.name}
                      aria-description={t(hasReacted(option.emoji) ? "memo.remove-reaction" : "memo.add-reaction")}
                      style={{ width: "100%" }}
                      onClick={() => onSelect(option.emoji)}
                    >
                      <span className="inline-flex size-5 items-center justify-center text-xl" aria-hidden>
                        {option.emoji}
                      </span>
                    </Combobox.Item>
                  ))}
                </Combobox.Row>
              ))}
          </div>
        </Combobox.List>
      </div>
    </Combobox.Root>
  );
}

const ReactionSelector = ({ memo, trigger }: Props) => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { handleReactionClick, isPending, canReact, hasReacted } = useReactionActions({ memo });
  const close = () => {
    triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };

  if (!canReact) return null;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (nextOpen && isPending) return;
        if (!nextOpen && details.reason === "escape-key") triggerRef.current?.focus({ preventScroll: true });
        setOpen(nextOpen);
      }}
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              ref={triggerRef}
              aria-label={t("memo.add-reaction")}
              aria-disabled={isPending}
              render={trigger ?? <Button variant="ghost" shape="pill" size="sm" icon={<SmilePlusIcon />} />}
            />
          }
        />
        <Tooltip.Popup>{t("memo.add-reaction")}</Tooltip.Popup>
      </Tooltip.Root>
      <Popover.Popup
        align="start"
        initialFocus={searchRef}
        aria-label={t("memo.add-reaction")}
        className="max-w-[calc(100vw-2rem)] p-[calc(var(--mu-space-3)-1px)] transition-none"
        style={{ width: `calc(${COLUMNS} * var(--mu-row-height) + ${COLUMNS - 1} * var(--mu-inset) + 2 * var(--mu-space-3))` }}
      >
        {open && (
          <EmojiGrid
            searchRef={searchRef}
            hasReacted={hasReacted}
            onClose={close}
            onSelect={(emoji) => {
              if (handleReactionClick(emoji)) close();
            }}
          />
        )}
      </Popover.Popup>
    </Popover.Root>
  );
};

export default ReactionSelector;
