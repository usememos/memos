import { cn } from "@/lib/utils";
import type { AttachmentVisualItem } from "@/utils/media-item";

export type VisualGalleryCell = {
  item: AttachmentVisualItem;
  className?: string;
  overlayLabel?: string;
};

/** Resolved layout for attachment visual previews — keeps grid rules in one place. */
export type VisualGalleryLayout =
  | { mode: "single"; item: AttachmentVisualItem }
  | { mode: "collage"; containerClassName: string; cells: VisualGalleryCell[] };

const TWO_ITEM_GRID_HEIGHT_CLASS = "h-[11rem] sm:h-[13rem] md:h-[15rem]";
const MOSAIC_GRID_HEIGHT_CLASS = "h-[13rem] sm:h-[16rem] md:h-[18rem]";
/** 2 rows × 3 columns */
const SIX_UP_GRID_HEIGHT_CLASS = "h-[14rem] sm:h-[17rem] md:h-[20rem]";

/** Max thumbnails shown in the 2×3 collage before `+N` on the last cell. */
export const COLLAGE_MAX_VISIBLE_CELLS = 6;

/**
 * Maps N visual items to a gallery layout (single, 2-up, 3-mosaic, 2×2, or 2×3 with optional +N).
 */
export const resolveVisualGalleryLayout = (items: AttachmentVisualItem[]): VisualGalleryLayout | null => {
  const count = items.length;

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return { mode: "single", item: items[0] };
  }

  if (count === 2) {
    return {
      mode: "collage",
      containerClassName: cn("grid grid-cols-2 gap-2", TWO_ITEM_GRID_HEIGHT_CLASS),
      cells: items.map((item) => ({ item })),
    };
  }

  if (count === 3) {
    return {
      mode: "collage",
      containerClassName: cn("grid grid-cols-2 grid-rows-2 gap-2", MOSAIC_GRID_HEIGHT_CLASS),
      cells: [{ item: items[0], className: "row-span-2" }, { item: items[1] }, { item: items[2] }],
    };
  }

  if (count === 4) {
    return {
      mode: "collage",
      containerClassName: cn("grid grid-cols-2 grid-rows-2 gap-2", MOSAIC_GRID_HEIGHT_CLASS),
      cells: items.map((item) => ({ item })),
    };
  }

  const visible = items.slice(0, COLLAGE_MAX_VISIBLE_CELLS);
  const overflowCount = items.length - visible.length;

  return {
    mode: "collage",
    containerClassName: cn("grid grid-cols-3 grid-rows-2 gap-2", SIX_UP_GRID_HEIGHT_CLASS),
    cells: visible.map((item, index) => ({
      item,
      overlayLabel: index === visible.length - 1 && overflowCount > 0 ? `+${overflowCount}` : undefined,
    })),
  };
};
