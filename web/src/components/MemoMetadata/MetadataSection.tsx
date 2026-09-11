import { type LucideIcon, XIcon } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { cn } from "@/lib/utils";

/**
 * The metadata lists under a memo (attachments, relations, location, comments) share one
 * row grammar with the sidebar rail: a 28px row, a 20px leading slot on the artwork rail,
 * a 13px label and a tabular detail rail. Only the hover wash differs, because these rows
 * sit on a card rather than the sidebar surface.
 */
export const METADATA_ROW_BOX_CLASSES =
  "group/row relative flex h-7 w-full min-w-0 items-center gap-1 rounded-md px-2 text-start text-ui text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";
/** A row that is itself the control: the box, the focus outline, and the quiet "on" fill while pressed or holding a popup open. */
export const METADATA_ROW_CLASSES = cn(
  METADATA_ROW_BOX_CLASSES,
  "aria-pressed:bg-accent aria-pressed:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground",
  FOCUS_VISIBLE_OUTLINE_CLASSES,
);
/** The focusable body of a split row; its gap must equal the box's `gap-1`. */
export const METADATA_ROW_LABEL_CLASSES = `flex h-full min-w-0 flex-1 items-center gap-1 text-start ${FOCUS_VISIBLE_OUTLINE_CLASSES}`;
export const METADATA_ROW_SLOT_CLASSES = "flex size-5 shrink-0 items-center justify-center";
export const METADATA_ROW_ICON_CLASSES = "me-auto size-4 shrink-0 opacity-75";
/** The row's text column: foreground ink, truncating. */
export const METADATA_ROW_TEXT_CLASSES = "min-w-0 flex-1 truncate text-foreground";
export const METADATA_ROW_DETAIL_CLASSES = "shrink-0 text-2xs tabular-nums text-muted-foreground/60";
/**
 * A slot that is itself a control (play, disclosure): the same box and glyph as any other
 * slot, so it reads like its siblings at rest. The glyph darkens under the pointer and
 * takes the accent ink while it is on; no chip, so the row keeps one surface.
 */
export const METADATA_ROW_SLOT_BUTTON_CLASSES = cn(
  METADATA_ROW_SLOT_CLASSES,
  "relative cursor-pointer rounded transition-colors hover:text-foreground hover:[&>svg]:opacity-100 aria-pressed:text-primary aria-pressed:[&>svg]:opacity-100 after:absolute after:-inset-0.5 after:content-['']",
  FOCUS_VISIBLE_OUTLINE_CLASSES,
);

/** A row is engaged by pointer or keyboard; everything that reveals or yields keys off this pair. */
const whenEngaged = (value: string) => `md:group-hover/row:${value} md:group-focus-within/row:${value}`;

/**
 * Trailing controls of an editable row. On desktop they overlay the row's end and stay
 * hidden until the row is engaged, so they never take width from the detail rail at
 * rest; on touch layouts they sit inline and always show.
 */
export const METADATA_ROW_CONTROLS_CLASSES = cn(
  "flex shrink-0 items-center gap-0.5 transition-opacity md:absolute md:inset-y-0 md:end-1 md:opacity-0",
  whenEngaged("opacity-100"),
);
/** A glyph hinting at what engaging the row does (download, open), overlaid where the detail rail was. */
export const METADATA_ROW_HINT_CLASSES = cn("absolute end-2 size-4 opacity-0 transition-opacity", whenEngaged("opacity-75"));
/** The detail rail gives way to whatever overlays it. */
export const METADATA_ROW_DETAIL_YIELD_CLASSES = cn("transition-opacity", whenEngaged("opacity-0"));

/**
 * Rows carry 8px of horizontal padding for their hover wash. A list of them pulls out by
 * that much so leading glyphs land on the memo's text edge, and spaces rows 2px apart.
 */
export const METADATA_ROW_LIST_CLASSES = "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-0.5";

/** The standard glyph-in-slot pairing, so every row draws its glyph identically. */
export const MetadataRowIconSlot = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className={METADATA_ROW_SLOT_CLASSES} aria-hidden="true">
    <Icon className={METADATA_ROW_ICON_CLASSES} strokeWidth={1.8} />
  </span>
);

const DETAIL_RAIL_CLASSES = cn(METADATA_ROW_DETAIL_CLASSES, METADATA_ROW_DETAIL_YIELD_CLASSES, "hidden items-center gap-1 sm:flex");

/** The detail rail: short facts separated by quiet dots, hidden on narrow screens where the label needs the room. */
export const MetadataRowDetail = ({ parts }: { parts: Array<string | undefined> }) => {
  const shown = parts.filter((part): part is string => Boolean(part));
  if (shown.length === 0) return null;
  return (
    <span className={DETAIL_RAIL_CLASSES}>
      {shown.map((part, index) => (
        <span key={part} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground/40">·</span>}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
};

/** An editable row's remove control, in the trailing overlay. */
export const MetadataRowRemoveControl = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <div className={METADATA_ROW_CONTROLS_CLASSES}>
    <Button variant="quiet" size="icon-sm" onClick={onClick} title="Remove" aria-label={label}>
      <XIcon className="size-3.5" strokeWidth={1.8} />
    </Button>
  </div>
);

interface MetadataSectionProps extends PropsWithChildren {
  title: string;
  count?: number;
  /** A control on the header's trailing end; it pulls out by its own padding to end on the text edge. */
  action?: ReactNode;
}

/**
 * A quiet titled list: a 24px header with an uppercase title on the text edge, then
 * rows whose leading glyph lands on that same edge. No box or band, so the list recedes
 * behind the memo's own content.
 */
const MetadataSection = ({ title, count, action, children }: MetadataSectionProps) => (
  <section className="w-full" aria-label={title}>
    <div className="mb-0.5 flex h-6 min-w-0 items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-1.5 text-2xs font-normal uppercase tracking-wide text-muted-foreground/55 select-none">
        <span className="truncate">{title}</span>
        {count != null && <span className="tabular-nums text-muted-foreground/60">{count}</span>}
      </h3>
      {action && <div className="-me-2 shrink-0">{action}</div>}
    </div>
    <div className={METADATA_ROW_LIST_CLASSES}>{children}</div>
  </section>
);

export default MetadataSection;
