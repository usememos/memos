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

/**
 * Shared popup component for displaying suggestion items.
 * Provides consistent styling and behavior across different suggestion types.
 *
 * Features:
 * - Automatically scrolls selected item into view
 * - Handles keyboard navigation highlighting
 * - Prevents text selection during mouse interaction
 * - Consistent styling with max height constraints
 */
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

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={containerRef}
      className="z-20 p-1 mt-1 -ml-2 absolute max-w-48 max-h-60 gap-px rounded font-mono flex flex-col overflow-y-auto overflow-x-hidden shadow-lg border bg-popover text-popover-foreground"
      style={{ left: position.left, top: position.top + position.height }}
    >
      {suggestions.map((item, i) => (
        <div
          key={getItemKey(item, i)}
          ref={i === selectedIndex ? selectedItemRef : null}
          onMouseDown={() => onItemSelect(item)}
          className={cn(
            "rounded p-1 px-2 w-full text-sm cursor-pointer transition-colors select-none",
            "hover:bg-accent hover:text-accent-foreground",
            i === selectedIndex ? "bg-accent text-accent-foreground" : "",
          )}
        >
          {renderItem(item, i === selectedIndex)}
        </div>
      ))}
    </div>
  );
}
