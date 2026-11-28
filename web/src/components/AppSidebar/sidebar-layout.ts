import { menuClasses } from "@usememos/ui";
import { cva } from "class-variance-authority";

/**
 * The sidebar is drawn on one shared rail: inset surfaces start 12px from the shell,
 * visible artwork starts at 20px, and first-level labels start at 44px. Rows reserve a 20px
 * artwork column. The sidebar carries the package's `mu-compact`, so its md rows and
 * controls are 28px tall: rows read their height and radius from the md row variables,
 * and compact navigation is a 28px square like the header's compose control.
 *
 * Text is one size, 13px: rows and open nav labels are `mu-label-sm`, so a row leads by
 * weight in secondary ink and stays quieter than the memos beside the rail.
 *
 * The end of the rail mirrors its start with one action axis, 26px from the edge: the centre
 * of a 28px control sitting on the 12px inset (compose, search, the calendar's last column).
 * Every trailing 20px control centres on it, so its box ends 16px from the edge: a box that
 * holds one (a section header, the month row, a view row) pads its end by 4px (`pe-1`).
 */
export const SIDEBAR_RAIL_CLASSES = "px-3";
// Content rows reserve 20px so 16px icons and 20px marks share a stable label rail.
export const SIDEBAR_LEADING_SLOT_CLASSES = "flex size-5 shrink-0 items-center justify-center";
// Compact nav uses the visible 16px glyph itself as the cell: 5px padding plus the 1px focus border each side.
export const SIDEBAR_NAV_LEADING_SLOT_CLASSES = "flex size-4 shrink-0 items-center justify-center";

/**
 * Brand controls hug their content and ordinary rows fill the inset rail.
 * The header brand is the sidebar's title, not a row: a semibold 14px name (the serif wordmark
 * for the product's own name), so it leads the 13px labels below by weight. It is as tall as the
 * compose control beside it, with a 40px hit area. It keeps the rows' x-geometry: 7px of padding
 * beside the 1px focus border puts its mark on the artwork rail and its name on the label rail
 * (a 20px mark and a 4px gap, or the 16px-wide bird and an 8px gap). The chevron follows the
 * name by the same 4px.
 * Heights stay fixed so data cannot change a surface's padding or vertical position.
 */
export const sidebarSurfaceVariants = cva("min-w-0 items-center", {
  variants: {
    role: {
      row: "mu-s-md flex h-(--mu-row-height) w-full gap-1 rounded-(--mu-row-radius) px-2 mu-label-sm",
      navPill: "mu-s-md relative flex h-(--mu-row-height) shrink-0 rounded-(--mu-row-radius) px-[5px]",
      headerBrand: "relative flex h-7 max-w-full gap-1 rounded-mu-md px-[7px] before:absolute before:inset-x-0 before:-inset-y-1.5",
      mobileBrand: "flex h-9 max-w-full gap-1.5 rounded-mu-md px-1",
    },
  },
  defaultVariants: {
    role: "row",
  },
});

/**
 * A panel opened from the sidebar (the title's places, the footer's account) spans the rail:
 * the sidebar's width less the trigger's inset on both sides.
 */
export const measureSidebarPanelWidth = (trigger: HTMLElement | null): number | undefined => {
  const sidebar = trigger?.closest("aside");
  if (!trigger || !sidebar) return undefined;
  const sidebarRect = sidebar.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const inlineInset = Math.min(Math.abs(triggerRect.left - sidebarRect.left), Math.abs(sidebarRect.right - triggerRect.right));
  const width = Math.floor(sidebarRect.width - inlineInset * 2);
  return width > 0 ? width : undefined;
};

/**
 * The panels that open from the sidebar title and footer are list Popovers whose menu rows use the
 * package's fixed 28px density. Each keeps a 20px leading slot, so icons, the avatar
 * and Space marks share one column; a Popover sets no highlight, so the rows add their own hover,
 * paler than the fill of the current page so the two never read as one state.
 * A row whose own menu is open takes the package's highlight.
 */
export const SCOPE_PANEL_ROW_CLASSES = `${menuClasses().item} transition-colors hover:bg-mu-hover/65 aria-[current=page]:bg-mu-hover border border-transparent mu-focus focus-visible:border-mu-focus`;
/** Rows keep the sidebar's 2px pitch, so the filled current row and a hovered neighbour stay two shapes. */
export const SCOPE_PANEL_STACK_CLASSES = "flex flex-col gap-0.5";
export const SCOPE_PANEL_ICON_CLASSES = "mu-icon text-mu-text-secondary";
