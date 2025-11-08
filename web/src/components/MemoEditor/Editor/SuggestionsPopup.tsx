import { ReactNode } from "react";
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
 */
export function SuggestionsPopup<T>({
  position,
  suggestions,
  selectedIndex,
  onItemSelect,
  renderItem,
  getItemKey,
}: SuggestionsPopupProps<T>) {
  return (
    <div
      className="z-20 p-1 mt-1 -ml-2 absolute max-w-48 gap-px rounded font-mono flex flex-col justify-start items-start overflow-auto shadow bg-popover"
      style={{ left: position.left, top: position.top + position.height }}
    >
      {suggestions.map((item, i) => (
        <div
          key={getItemKey(item, i)}
          onMouseDown={() => onItemSelect(item)}
          className={cn(
            "rounded p-1 px-2 w-full truncate text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
            i === selectedIndex ? "bg-accent text-accent-foreground" : "",
          )}
        >
          {renderItem(item, i === selectedIndex)}
        </div>
      ))}
    </div>
  );
}
