/**
 * Converts a google.type.Color (r/g/b as 0–1 floats) to a CSS hex string (#rrggbb).
 * Returns undefined when no color is provided.
 */
export const colorToHex = (color?: { red?: number; green?: number; blue?: number }): string | undefined => {
  if (!color) return undefined;
  const clamp = (val: number | undefined): number => {
    const n = val ?? 0;
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  };
  const r = Math.round(clamp(color.red) * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(clamp(color.green) * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(clamp(color.blue) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
};
