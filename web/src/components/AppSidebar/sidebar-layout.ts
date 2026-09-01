import { cva } from "class-variance-authority";

/**
 * The sidebar is drawn on one shared rail: inset surfaces start 12px from the shell,
 * visible artwork starts at 20px, and first-level labels start at 44px. Rows reserve a
 * 20px artwork column; compact navigation reaches the same rails with a 16px glyph and
 * an 8px label gap. Keeping those coordinates here prevents independent pill geometry.
 */
export const SIDEBAR_RAIL_CLASSES = "px-3";
// Content rows reserve 20px so 16px icons and 20px marks share a stable label rail.
export const SIDEBAR_LEADING_SLOT_CLASSES = "flex size-5 shrink-0 items-center justify-center";
// Compact nav uses the visible 16px glyph itself as the cell, keeping 8px x/y padding.
export const SIDEBAR_NAV_LEADING_SLOT_CLASSES = "flex size-4 shrink-0 items-center justify-center";

/**
 * Only two width behaviours are allowed: brand controls hug their content while rows
 * fill the shared rail. Heights are fixed from the artwork size, so data cannot change
 * a surface's padding or vertical position.
 */
export const sidebarSurfaceVariants = cva("min-w-0 items-center rounded-md", {
  variants: {
    role: {
      row: "flex h-8 w-full gap-1 px-2 text-ui",
      navPill: "relative flex h-8 px-2",
      headerBrand: "flex h-9 max-w-full gap-1 px-2",
      mobileBrand: "flex h-9 max-w-full gap-1.5 px-1",
      account: "flex h-9 w-full gap-1 px-2",
    },
  },
  defaultVariants: {
    role: "row",
  },
});

export const SIDEBAR_FOOTER_CLASSES = `${SIDEBAR_RAIL_CLASSES} py-1.5`;
