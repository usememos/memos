import { cva } from "class-variance-authority";

/**
 * The sidebar is drawn on one shared rail: inset surfaces start 12px from the shell,
 * visible artwork starts at 20px, and first-level labels start at 44px. The full-bleed
 * footer action pads its content directly onto those same rails. Rows reserve a 20px
 * artwork column. Compact navigation is a 28px square like the header's compose control,
 * so its glyph sits 2px inside the artwork rail and reaches the label rail with a 10px gap.
 */
export const SIDEBAR_RAIL_CLASSES = "px-3";
// Content rows reserve 20px so 16px icons and 20px marks share a stable label rail.
export const SIDEBAR_LEADING_SLOT_CLASSES = "flex size-5 shrink-0 items-center justify-center";
// Compact nav uses the visible 16px glyph itself as the cell, keeping 6px x/y padding.
export const SIDEBAR_NAV_LEADING_SLOT_CLASSES = "flex size-4 shrink-0 items-center justify-center";

/**
 * Brand controls hug their content, ordinary rows fill the inset rail, and the account
 * action fills the footer shell (or becomes a rail-aligned square when collapsed).
 * The header brand is the sidebar's title, not a row: a 24px mark on the artwork rail and
 * a larger label, so it reads as a different kind of object from the 16px nav pills below.
 * Heights stay fixed so data cannot change a surface's padding or vertical position.
 */
export const sidebarSurfaceVariants = cva("min-w-0 items-center", {
  variants: {
    role: {
      row: "flex h-7 w-full gap-1 rounded-md px-2 text-ui",
      navPill: "relative flex h-7 rounded-md px-1.5",
      headerBrand: "flex h-9 max-w-full gap-2 rounded-md px-2",
      mobileBrand: "flex h-9 max-w-full gap-1.5 rounded-md px-1",
      account: "flex h-9 w-full gap-1 rounded-none px-5",
      accountCollapsed: "ms-3 flex size-9 rounded-md p-2",
    },
  },
  defaultVariants: {
    role: "row",
  },
});
