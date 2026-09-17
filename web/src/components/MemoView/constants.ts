import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { cn } from "@/lib/utils";

export const MEMO_CARD_BASE_CLASSES = cn(
  "relative group flex flex-col justify-start items-start bg-card w-full px-4 py-3 mb-2 gap-2 text-card-foreground rounded-xl border border-border/70 shadow-xs",
  "transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none",
  "hover:border-primary/30 hover:shadow-md focus-within:border-primary/30 focus-within:shadow-md",
  "group-hover/card:border-primary/30 group-hover/card:shadow-md group-focus-within/card:border-primary/30 group-focus-within/card:shadow-md",
);

/**
 * A memo's timestamp as a control, on the card header and in the editor: one line of muted
 * 13px text with no box, darkening on hover like every quiet label.
 */
export const MEMO_TIME_CONTROL_CLASSES = cn(
  "shrink-0 whitespace-nowrap rounded-sm text-start text-ui text-muted-foreground transition-colors select-none hover:text-foreground",
  FOCUS_VISIBLE_OUTLINE_CLASSES,
);

export const RELATIVE_TIME_THRESHOLD_MS = 1000 * 60 * 60 * 24;
