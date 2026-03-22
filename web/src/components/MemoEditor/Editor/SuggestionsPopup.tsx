import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Position } from "./useSuggestions";

interface SuggestionsPopupProps<T> {
  position: Position;
  suggestions: T[];
  selectedIndex: number;
  onItemSelect: (item: T) => void;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T, index: number) => string;
}

const POPUP_STYLES = {
  container:
    "z-20 absolute p-1 mt-1 -ml-2 max-w-48 max-h-60 rounded border bg-popover text-popover-foreground shadow-lg font-mono flex flex-col overflow-y-auto overflow-x-hidden",
  item: "rounded p-1 px-2 w-full text-sm cursor-pointer transition-colors select-none hover:bg-accent hover:text-accent-foreground",
};

export function SuggestionsPopup<T>({
  position,
  suggestions,
  selectedIndex,
  onItemSelect,
  renderItem,
  getItemKey,
}: SuggestionsPopupProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <div ref={containerRef} className={POPUP_STYLES.container} style={{ left: position.left, top: position.top + position.height }}>
      {suggestions.map((item, i) => (
        <div
          key={getItemKey(item, i)}
          ref={i === selectedIndex ? selectedItemRef : null}
          onMouseDown={() => onItemSelect(item)}
          className={cn(POPUP_STYLES.item, i === selectedIndex && "bg-accent text-accent-foreground")}
        >
          {renderItem(item, i === selectedIndex)}
        </div>
      ))}
    </div>
  );
}
