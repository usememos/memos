/**
 * Tailwind class bundles for attachment visual tiles (`VisualTile`, collage, single image/video).
 * Hover uses `group/media` on {@link MEDIA_HOVER_SURFACE_CLASS} so scale/gradient track the media surface, not the outer button chrome.
 */

// No `outline-none`: as a utility it would override `mu-focus` and hide the keyboard outline.
export const VISUAL_TILE_BUTTON_CLASS =
  "relative block overflow-hidden rounded-mu-md border border-mu-line/70 bg-mu-well/30 p-0 text-left transition-colors mu-focus";

/**
 * A drawing is a sheet of paper on the card rather than a photo in a frame: no tile border or
 * well, just the package's raised edge, the same in both themes. Hover lifts it a little more
 * instead of the photo scrim and zoom.
 */
export const DRAWING_SHEET_TILE_CLASS =
  "relative block overflow-hidden rounded-mu-md p-0 text-left shadow-mu-raised transition-shadow hover:shadow-mu-key mu-focus";

/** A lone drawing: the sheet spans the column, at least 160px tall, with the drawing centered on it. */
export const DRAWING_SHEET_SINGLE_CLASS = "flex w-full min-h-40 items-center justify-center";

/** The drawing on a lone sheet: at the size it was drawn, shrunk only to fit the column and 400px. */
export const DRAWING_SHEET_MEDIA_CLASS = "block h-auto max-h-100 w-auto max-w-full";

/** A drawing in a collage cell fits inside it on paper; cropping it like a photo would cut strokes off. */
export const DRAWING_SHEET_CELL_MEDIA_CLASS = "h-full w-full object-contain p-2";

export const MEDIA_HOVER_SURFACE_CLASS = "group/media relative h-full min-h-0 w-full overflow-hidden";

export const COVER_MEDIA_CLASS = "h-full w-full rounded-none object-cover transition-transform duration-300 group-hover/media:scale-[1.02]";

export const NATURAL_MEDIA_CLASS =
  "block h-auto max-h-[20rem] w-auto max-w-full rounded-none transition-transform duration-300 group-hover/media:scale-[1.02]";

/** Motion overlay video in single-tile layout (pairs with {@link NATURAL_MEDIA_CLASS} poster). */
export const SINGLE_MOTION_VIDEO_CLASS =
  "absolute inset-0 h-full w-full rounded-none object-contain transition-transform duration-300 group-hover/media:scale-[1.02]";

export const SINGLE_VIDEO_CARD_WIDTH_CLASS = "w-full max-w-[30rem]";

/** Stacking inside {@link MEDIA_HOVER_SURFACE_CLASS}: gradient < badge < overflow mask. */
export const VISUAL_Z = {
  gradient: "z-[1]",
  badge: "z-[2]",
  overflowMask: "z-[3]",
} as const;

export const MEDIA_HOVER_GRADIENT_CLASS = `pointer-events-none absolute inset-0 ${VISUAL_Z.gradient} bg-gradient-to-t from-mu-ink/15 via-transparent to-transparent opacity-0 transition-opacity group-hover/media:opacity-100`;

export const COLLAGE_VIDEO_PLAY_BADGE_CLASS = `bottom-2 right-2 ${VISUAL_Z.badge} h-7 w-7 bg-mu-canvas/80 text-mu-ink/70`;

export const OVERFLOW_TILE_OVERLAY_CLASS = `pointer-events-none absolute inset-0 ${VISUAL_Z.overflowMask} flex items-center justify-center bg-black/45 mu-heading text-white backdrop-blur-[2px]`;
