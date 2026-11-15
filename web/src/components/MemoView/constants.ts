import { cn } from "@/lib/utils";

export const MEMO_CARD_BASE_CLASSES =
  "relative group flex flex-col justify-start items-start bg-mu-surface w-full px-4 py-3 mb-2 gap-2 text-mu-text rounded-mu-lg border border-mu-line/70 transition-colors";

/**
 * A memo's timestamp as a control, on the card header and in the editor: one line of muted
 * 13px text with no box, darkening on hover like every quiet label.
 */
export const MEMO_TIME_CONTROL_CLASSES = cn(
  "shrink-0 whitespace-nowrap rounded-mu-sm text-start mu-caption text-mu-text-secondary transition-colors select-none hover:text-mu-text",
  "border border-transparent mu-focus focus-visible:border-mu-focus",
);

export const RELATIVE_TIME_THRESHOLD_MS = 1000 * 60 * 60 * 24;
