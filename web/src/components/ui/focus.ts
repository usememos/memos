/**
 * The kit's one focus treatment: a 2px inset outline in the ring color, drawn only for
 * keyboard focus. Outline, not `ring-*`, so it never adds to the box or reads as a border.
 * Kit buttons carry it from their base; raw controls take it from here. Small
 * checkboxes, radios, and switches move the outline outside their visual bounds.
 */
export const FOCUS_VISIBLE_OUTLINE_CLASSES =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60";

/** Form fields keep validation visible while sharing the kit's keyboard outline. */
export const FIELD_FOCUS_CLASSES = `${FOCUS_VISIBLE_OUTLINE_CLASSES} focus-visible:border-ring aria-invalid:border-destructive aria-invalid:hover:border-destructive aria-invalid:focus-visible:outline-destructive data-invalid:border-destructive data-invalid:hover:border-destructive data-invalid:focus-visible:outline-destructive`;
