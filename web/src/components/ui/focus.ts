/**
 * The kit's one focus treatment: a 2px inset outline in the ring color, drawn only for
 * keyboard focus. Outline, not `ring-*`, so it never adds to the box or reads as a border.
 * Kit buttons carry it from their base; raw elements that act as controls (calendar grid
 * cells, the reaction chip) take it from here.
 */
export const FOCUS_VISIBLE_OUTLINE_CLASSES =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60";
