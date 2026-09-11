import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { cn } from "@/lib/utils";

export const MEMO_CARD_BASE_CLASSES =
  "relative group flex flex-col justify-start items-start bg-card w-full px-4 py-3 mb-2 gap-2 text-card-foreground rounded-lg border border-border/70 transition-colors";

/**
 * A memo's timestamp as a control, on the card header and in the editor: one line of muted
 * 13px text with no box, darkening on hover like every quiet label.
 */
export const MEMO_TIME_CONTROL_CLASSES = cn(
  "shrink-0 whitespace-nowrap rounded-sm text-start text-ui text-muted-foreground transition-colors select-none hover:text-foreground",
  FOCUS_VISIBLE_OUTLINE_CLASSES,
);

export const RELATIVE_TIME_THRESHOLD_MS = 1000 * 60 * 60 * 24;
