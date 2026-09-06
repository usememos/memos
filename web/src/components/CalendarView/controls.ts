import { cn } from "@/lib/utils";

/**
 * One quiet control grammar for the calendar, in the spirit of Notion and Linear: 28px tall,
 * 13px text, muted ink that darkens on hover under a light wash, even padding, and the accent
 * fill reserved for a pressed or current state. Raw elements carry these classes so the kit's
 * variants never fight them.
 */
/** The ring-free focus treatment every calendar control and grid cell shares. */
export const CALENDAR_FOCUS_CLASSES =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60";

const CALENDAR_CONTROL_CLASSES = cn(
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md text-ui text-muted-foreground/70 no-underline transition-colors hover:bg-muted/60 hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
  CALENDAR_FOCUS_CLASSES,
);

/** A control that is only a glyph: a 28px square. */
export const CALENDAR_ICON_CONTROL_CLASSES = cn(CALENDAR_CONTROL_CLASSES, "w-7 justify-center");

/** A control with a label: 8px of side padding, so the hover wash is a chip around the words. */
export const CALENDAR_TEXT_CONTROL_CLASSES = cn(CALENDAR_CONTROL_CLASSES, "px-2");

/** The one state that takes a fill: the place you are, or the thing that is on. */
export const CALENDAR_CONTROL_ACTIVE_CLASSES = "bg-accent text-accent-foreground hover:bg-accent";
