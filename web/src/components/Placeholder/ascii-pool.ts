export type PlaceholderVariant = "empty" | "loading" | "noResults" | "notFound";

export type MotionStyle = "bob" | "flutter" | "none";

export interface AsciiPiece {
  id: string;
  variant: PlaceholderVariant;
  ascii: string;
  credit: string;
  motion: MotionStyle;
}

export const ASCII_POOL: AsciiPiece[] = [];

export function pickPiece(variant: PlaceholderVariant): AsciiPiece {
  const matches = ASCII_POOL.filter((p) => p.variant === variant);
  if (matches.length === 0) {
    throw new Error(`No ASCII piece registered for variant "${variant}"`);
  }
  return matches[Math.floor(Math.random() * matches.length)];
}
