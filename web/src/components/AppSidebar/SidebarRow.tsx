import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SCOPE_PANEL_ICON_CLASSES, SIDEBAR_LEADING_SLOT_CLASSES, sidebarSurfaceVariants } from "./sidebar-layout";

/**
 * The rail's row rhythm — height, type scale, radius, padding, gap. Every list in the
 * sidebar is built from this, so a row reads the same whether it is a view, a setting or
 * a tag. Split from the focus treatment because a row is not always its own focus target:
 * rows that carry a trailing control put the box on a wrapper and focus on the button
 * inside it.
 */
export const SIDEBAR_ROW_BOX_CLASSES = `${sidebarSurfaceVariants({ role: "row" })} group transition-colors`;

export const SIDEBAR_ROW_CLASSES = `${SIDEBAR_ROW_BOX_CLASSES} mu-focus`;

export const SIDEBAR_ROW_ICON_CLASSES =
  // The md row's 16px icon at the md stroke, beside its 14px label, in the row's own muted ink.
  "mu-icon me-auto shrink-0 group-data-checked:text-mu-primary";
const SIDEBAR_ROW_COUNT_CLASSES = "mu-caption tabular-nums text-mu-ink-muted group-data-checked:text-mu-primary";

/**
 * The focusable body of a split row — rows whose box is a wrapper carrying other controls
 * put their label layout and focus ring here. The gap must stay equal to the box's own
 * `gap-1` or slot alignment breaks between one-control and split rows.
 */
export const SIDEBAR_ROW_LABEL_CLASSES = `flex h-full min-w-0 flex-1 items-center gap-1 text-start mu-focus`;

/**
 * Fixed leading slot: a 20px column begins on the artwork rail. Small glyphs pin to its
 * start while 20px marks fill it; the following 4px gap puts every first-level label on
 * the same rail without compensating margins.
 */
export const SIDEBAR_ROW_SLOT_CLASSES = SIDEBAR_LEADING_SLOT_CLASSES;

/** A slot that is itself a control (disclosure, row menu): same box plus the hover chip. */
export const SIDEBAR_ROW_SLOT_BUTTON_CLASSES = `${SIDEBAR_ROW_SLOT_CLASSES} relative rounded hover:bg-mu-hover after:absolute after:-inset-0.5 after:content-[''] mu-focus`;

/** Trailing rail for counts, wide enough that digits align down the list. */
export const SIDEBAR_ROW_COUNT_RAIL_CLASSES = `${SIDEBAR_ROW_COUNT_CLASSES} min-w-[3ch] shrink-0 text-end`;

/** The standard icon-in-slot pairing, so every list renders its glyphs identically. */
export const SidebarRowIconSlot = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className={SIDEBAR_ROW_SLOT_CLASSES} aria-hidden="true">
    <Icon className={SIDEBAR_ROW_ICON_CLASSES} />
  </span>
);

/**
 * The scope panel's leading icon (see sidebar-layout): links, actions and submenu triggers in
 * the panel share the 20px leading slot with the sidebar rows above them.
 */
export const ScopePanelRowIcon = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span className={SIDEBAR_LEADING_SLOT_CLASSES} aria-hidden="true">
    <Icon className={cn(SCOPE_PANEL_ICON_CLASSES, className)} />
  </span>
);

/**
 * One selected look per meaning, kept together so lists cannot drift apart.
 * `current` is the place you are (nav pills, settings sections, list scopes) and fills the
 * row. `checked` is a filter that is on (a view, a tag) and must never read as a page: no
 * surface, foreground text, an accent mark on the rail edge, accent icon and count.
 */
export type SidebarRowState = "idle" | "current" | "checked";

const SIDEBAR_ROW_HOVER_CLASSES = "hover:bg-mu-hover/65 hover:text-mu-ink";

export const sidebarRowStateClasses = (state: SidebarRowState = "idle") => {
  // Selection never changes weight (the type rules), so labels do not shift: fill and color carry it.
  if (state === "current") return "bg-mu-hover text-mu-ink";
  if (state === "checked") {
    // The mark hangs in the rail's 12px inset so the label stays on its rail.
    return `relative text-mu-ink ${SIDEBAR_ROW_HOVER_CLASSES} before:absolute before:inset-y-1.5 before:-start-3 before:w-0.5 before:rounded-e-full before:bg-mu-primary before:content-['']`;
  }
  return `text-mu-ink-muted ${SIDEBAR_ROW_HOVER_CLASSES}`;
};

/** Goes on the row box so the icon slot and count rail inside it can take the checked colour. */
export const sidebarRowStateAttributes = (state: SidebarRowState) => ({
  "data-checked": state === "checked" ? "" : undefined,
});

interface Props {
  state?: SidebarRowState;
  icon?: LucideIcon;
  label: ReactNode;
  count?: number;
  onClick?: () => void;
  trailing?: ReactNode;
}

const SidebarRow = ({ state = "idle", icon: Icon, label, count, onClick, trailing }: Props) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={state !== "idle" || undefined}
    {...sidebarRowStateAttributes(state)}
    className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(state))}
  >
    {Icon && <SidebarRowIconSlot icon={Icon} />}
    <span data-sidebar-label className="min-w-0 flex-1 truncate text-start">
      {label}
    </span>
    {count != null && count > 0 && <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{count}</span>}
    {trailing}
  </button>
);

export default SidebarRow;
