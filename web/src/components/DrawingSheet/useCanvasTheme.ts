import type { CanvasTheme } from "@usememos/canvas";
import { useState } from "react";

/**
 * Every drawing is a sheet of the same paper, whatever memos' theme: it reads the same on a
 * light or a dark card, and anywhere its PNG goes. The paper is stored in the drawing, so a
 * drawing made before keeps the paper it was made with.
 */
export const DRAWING_PAPER = "#fbfaf7";

/** Dark ink for the light paper: the default pen and the palette's first color. */
export const DRAWING_INK = "#1a1a1a";

/** The light theme's accent, since selection and handles are drawn on the light paper. */
const DRAWING_ACCENT = "oklch(0.5 0.13 255)";

/** Seven hues that read on the paper; the palette's first color is the ink. */
export const DRAWING_HUES = [
  { key: "gray", value: "#868e96" },
  { key: "red", value: "#e03131" },
  { key: "orange", value: "#f08c00" },
  { key: "green", value: "#2f9e44" },
  { key: "teal", value: "#0c8599" },
  { key: "blue", value: "#1971c2" },
  { key: "violet", value: "#7048e8" },
] as const;

const DRAWING_THEME: CanvasTheme = {
  paper: DRAWING_PAPER,
  text: DRAWING_INK,
  selection: DRAWING_ACCENT,
  handle: DRAWING_ACCENT,
  palette: [DRAWING_INK, ...DRAWING_HUES.map((hue) => hue.value)],
};

/**
 * The canvas theme: the fixed paper and ink, with text in memos' sans-serif stack as the
 * browser resolved it. The sheet's own bars still follow memos' theme around the paper.
 */
export const useCanvasTheme = () => {
  const [fontFamily] = useState(() => getComputedStyle(document.documentElement).getPropertyValue("--mu-font-sans").trim());
  return { theme: DRAWING_THEME, ink: DRAWING_INK, fontFamily };
};
