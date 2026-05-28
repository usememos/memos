/**
 * Tailwind class bundles for attachment visual tiles (`VisualTile`, collage, single image/video).
 * Hover uses `group/media` on {@link MEDIA_HOVER_SURFACE_CLASS} so scale/gradient track the media surface, not the outer button chrome.
 */

export const VISUAL_TILE_BUTTON_CLASS =
  "relative block overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-0 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50";

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

export const MEDIA_HOVER_GRADIENT_CLASS = `pointer-events-none absolute inset-0 ${VISUAL_Z.gradient} bg-gradient-to-t from-foreground/15 via-transparent to-transparent opacity-0 transition-opacity group-hover/media:opacity-100`;

export const COLLAGE_VIDEO_PLAY_BADGE_CLASS = `bottom-2 right-2 ${VISUAL_Z.badge} h-7 w-7 bg-background/80 text-foreground/70`;

export const OVERFLOW_TILE_OVERLAY_CLASS = `pointer-events-none absolute inset-0 ${VISUAL_Z.overflowMask} flex items-center justify-center bg-black/45 text-2xl font-semibold text-white backdrop-blur-[2px]`;
