import type { CanvasTheme } from "@usememos/canvas";
import { useEffect, useMemo, useState } from "react";

/** The tokens the drawing takes from memos' theme, read as the browser resolved them. */
interface ThemeColors {
  paper: string;
  ink: string;
  accent: string;
  fontFamily: string;
}

const readColors = (): ThemeColors => {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    paper: token("--mu-surface"),
    ink: token("--mu-ink"),
    accent: token("--mu-accent"),
    fontFamily: token("--mu-font-sans"),
  };
};

/** Seven hues that read on light and dark paper; the palette's first color is the theme's ink. */
export const DRAWING_HUES = [
  { key: "gray", value: "#868e96" },
  { key: "red", value: "#e03131" },
  { key: "orange", value: "#f08c00" },
  { key: "green", value: "#2f9e44" },
  { key: "teal", value: "#0c8599" },
  { key: "blue", value: "#1971c2" },
  { key: "violet", value: "#7048e8" },
] as const;

/**
 * The canvas theme from memos' current theme: paper is the surface, strokes and text
 * are the ink, selection and handles are the accent. It follows a theme switch while
 * the sheet is open. It watches `data-theme` on the document rather than the resolved
 * theme setting (`useResolvedTheme`): the tokens change when `loadTheme` sets the
 * attribute, which happens in an effect after this component's own effects run.
 */
export const useCanvasTheme = () => {
  const [colors, setColors] = useState(readColors);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const theme = useMemo<CanvasTheme>(
    () => ({
      paper: colors.paper,
      text: colors.ink,
      selection: colors.accent,
      handle: colors.accent,
      palette: [colors.ink, ...DRAWING_HUES.map((hue) => hue.value)],
    }),
    [colors],
  );

  return { theme, ink: colors.ink, fontFamily: colors.fontFamily };
};
