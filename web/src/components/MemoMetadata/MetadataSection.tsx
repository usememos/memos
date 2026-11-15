import { Button, Tooltip } from "@usememos/ui";
import { type LucideIcon, XIcon } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { SIDEBAR_LEADING_SLOT_CLASSES } from "@/components/AppSidebar/sidebar-layout";
import { cn } from "@/lib/utils";

/**
 * The metadata lists under a memo (attachments, relations, location, comments) share one
 * row grammar with the sidebar rail: a 28px row, a 20px leading slot on the artwork rail,
 * a 13px label and a tabular detail rail. Only the hover wash differs, because these rows
 * sit on a card rather than the sidebar surface.
 */
export const METADATA_ROW_BOX_CLASSES =
  "group/row relative flex h-7 w-full min-w-0 items-center gap-1 rounded-mu-md px-2 text-start mu-caption text-mu-text-secondary transition-colors hover:bg-mu-hover hover:text-mu-text";
/** A row that is itself the control: the box, the focus outline, and the quiet "on" fill while pressed or holding a popup open. */
export const METADATA_ROW_CLASSES = cn(
  METADATA_ROW_BOX_CLASSES,
  "aria-pressed:bg-mu-hover aria-pressed:text-mu-text data-popup-open:bg-mu-hover data-popup-open:text-mu-text",
  "border border-transparent mu-focus focus-visible:border-mu-focus",
);
/**
 * The compact row: 24px instead of 28px, for a list that previews rather than edits (the
 * comment strip under a feed card). It packs rows into one block of lines.
 */
export const METADATA_COMPACT_ROW_CLASSES = cn(METADATA_ROW_CLASSES, "h-6");
/** The focusable body of a split row; its gap must equal the box's `gap-1`. */
export const METADATA_ROW_LABEL_CLASSES =
  "flex h-full min-w-0 flex-1 items-center gap-1 text-start border border-transparent mu-focus focus-visible:border-mu-focus";
/** The same 20px leading column the sidebar's rows reserve, so glyphs share one rail across both. */
export const METADATA_ROW_SLOT_CLASSES = SIDEBAR_LEADING_SLOT_CLASSES;
export const METADATA_ROW_ICON_CLASSES = "mu-icon-sm me-auto shrink-0";
/**
 * The row's text column, truncating. It inherits the row's muted ink: a reference, a place or a
 * comment describes the memo, so it reads a step below the memo's own words and darkens with the
 * row on hover.
 */
export const METADATA_ROW_TEXT_CLASSES = "min-w-0 flex-1 truncate";
/** An attachment is content, not a description, so its row text keeps the memo's ink. */
export const METADATA_ROW_CONTENT_TEXT_CLASSES = cn(METADATA_ROW_TEXT_CLASSES, "text-mu-text");
export const METADATA_ROW_DETAIL_CLASSES = "shrink-0 mu-caption tabular-nums text-mu-text-secondary";
/**
 * A slot that is itself a control (play, disclosure): the same box and glyph as any other
 * slot, so it reads like its siblings at rest. The glyph darkens under the pointer and
 * takes the accent ink while it is on; no chip, so the row keeps one surface.
 */
export const METADATA_ROW_SLOT_BUTTON_CLASSES = cn(
  METADATA_ROW_SLOT_CLASSES,
  "relative cursor-pointer rounded transition-colors hover:text-mu-text aria-pressed:text-mu-primary after:absolute after:-inset-0.5 after:content-['']",
  "border border-transparent mu-focus focus-visible:border-mu-focus",
);

/*
 * A row is engaged by pointer or keyboard; everything that reveals or yields keys off the
 * md:group-hover/row and md:group-focus-within/row pair. The class names are spelled out in
 * full because Tailwind only generates classes it finds literally in the source.
 */

/**
 * Trailing controls of an editable row. On desktop they overlay the row's end and stay
 * hidden until the row is engaged, so they never take width from the detail rail at
 * rest; on touch layouts they sit inline and always show.
 */
export const METADATA_ROW_CONTROLS_CLASSES = cn(
  "flex shrink-0 items-center gap-0.5 transition-opacity md:absolute md:inset-y-0 md:end-1 md:opacity-0",
  "md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100",
);
/** A glyph hinting at what engaging the row does (download, open), overlaid where the detail rail was. */
export const METADATA_ROW_HINT_CLASSES = cn(
  "mu-icon-sm absolute end-2 opacity-0 transition-opacity",
  "md:group-hover/row:opacity-75 md:group-focus-within/row:opacity-75",
);
/** The detail rail gives way to whatever overlays it. */
export const METADATA_ROW_DETAIL_YIELD_CLASSES = cn(
  "transition-opacity",
  "md:group-hover/row:opacity-0 md:group-focus-within/row:opacity-0",
);

/**
 * Rows carry 8px of horizontal padding for their hover wash. A list of them pulls out by
 * that much so leading glyphs land on the memo's text edge, and spaces rows 2px apart.
 */
export const METADATA_ROW_LIST_CLASSES = "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-0.5";

/** The standard glyph-in-slot pairing, so every row draws its glyph identically. */
export const MetadataRowIconSlot = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className={METADATA_ROW_SLOT_CLASSES} aria-hidden="true">
    <Icon className={METADATA_ROW_ICON_CLASSES} />
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
          {index > 0 && <span className="text-mu-text-secondary/40">·</span>}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
};

/** An editable row's remove control, in the trailing overlay. */
export const MetadataRowRemoveControl = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <div className={METADATA_ROW_CONTROLS_CLASSES}>
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="ghost" size="xs" onClick={onClick} aria-label={label} icon={<XIcon />} />} />
      <Tooltip.Popup>{label}</Tooltip.Popup>
    </Tooltip.Root>
  </div>
);

interface MetadataSectionProps extends PropsWithChildren {
  title: string;
  count?: number;
  /** A control on the header's trailing end; it pulls out by its own padding to end on the text edge. */
  action?: ReactNode;
  /** `compact` sets a 20px header over gapless rows, to pair with `METADATA_COMPACT_ROW_CLASSES`. */
  density?: "default" | "compact";
}

/**
 * A quiet titled list: a 24px header (20px when compact) with a sentence-case title on the text
 * edge in the sidebar's section-header style, its count beside it, then rows whose leading glyph
 * lands on that same edge. No box or band, so the list recedes behind the memo's own content.
 */
const MetadataSection = ({ title, count, action, density = "default", children }: MetadataSectionProps) => (
  <section className="w-full" aria-label={title}>
    <div className={cn("flex min-w-0 items-center justify-between gap-2", density === "compact" ? "h-5" : "mb-0.5 h-6")}>
      <h3 className="flex min-w-0 items-center gap-1.5 mu-label-sm text-mu-text-secondary select-none">
        <span className="truncate">{title}</span>
        {count != null && <span className="mu-caption tabular-nums">{count}</span>}
      </h3>
      {action && <div className="-me-2 shrink-0">{action}</div>}
    </div>
    <div className={cn(METADATA_ROW_LIST_CLASSES, density === "compact" && "gap-0")}>{children}</div>
  </section>
);

export default MetadataSection;
