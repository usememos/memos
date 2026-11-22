import { menuClasses } from "@usememos/ui";
import { cva } from "class-variance-authority";

/**
 * The sidebar is drawn on one shared rail: inset surfaces start 12px from the shell,
 * visible artwork starts at 20px, and first-level labels start at 44px. The full-bleed
 * footer action pads its content directly onto those same rails. Rows reserve a 20px
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
 * Brand controls hug their content, ordinary rows fill the inset rail, and the account
 * action fills the footer shell (or becomes a rail-aligned square when collapsed).
 * The header brand is the sidebar's title, not a row: a 24px-tall mark on the artwork rail and
 * a larger label, so it reads as a different kind of object from the 16px nav pills below.
 * Heights stay fixed so data cannot change a surface's padding or vertical position.
 */
export const sidebarSurfaceVariants = cva("min-w-0 items-center", {
  variants: {
    role: {
      row: "mu-s-md flex h-(--mu-row-height) w-full gap-1 rounded-(--mu-row-radius) px-2 mu-label-sm",
      navPill: "mu-s-md relative flex h-(--mu-row-height) shrink-0 rounded-(--mu-row-radius) px-[5px]",
      headerBrand: "flex h-9 max-w-full gap-2 rounded-mu-md px-2",
      mobileBrand: "flex h-9 max-w-full gap-1.5 rounded-mu-md px-1",
      account: "flex h-9 w-full gap-1 rounded-none px-5",
      accountCollapsed: "ms-3 flex size-9 rounded-mu-md p-2",
    },
  },
  defaultVariants: {
    role: "row",
  },
});

/**
 * The scope panel that opens from the sidebar title is a list Popover whose menu rows use the
 * package's fixed 28px density. Each keeps a 20px leading slot, so icons, the avatar
 * and Space marks share one column; a Popover sets no highlight, so the rows add their own hover.
 * A row whose own menu is open takes the package's highlight.
 */
export const SCOPE_PANEL_ROW_CLASSES = `${menuClasses().item} transition-colors hover:bg-mu-hover aria-[current=page]:bg-mu-hover border border-transparent mu-focus focus-visible:border-mu-focus`;
export const SCOPE_PANEL_ICON_CLASSES = "mu-icon text-mu-text-secondary";
