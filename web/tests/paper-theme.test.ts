import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { themeTokens } from "@usememos/ui";
import { describe, expect, it } from "vitest";

// Read from disk: Vitest replaces CSS imports, `?raw` included, with empty strings.
const paper = readFileSync(resolve(import.meta.dirname, "../src/themes/paper.css"), "utf8");

/** The custom properties Paper declares, with `var()` references resolved. */
const declarations = (() => {
  const raw = new Map<string, string>();
  const block = paper.slice(paper.indexOf("{") + 1, paper.lastIndexOf("}"));
  for (const line of block.split(";")) {
    const match = line.trim().match(/^(--mu-[\w-]+):\s*(.+)$/s);
    if (match) raw.set(match[1], match[2].trim());
  }
  const resolve = (value: string): string => value.replace(/var\((--mu-[\w-]+)\)/g, (_, name) => resolve(raw.get(name) ?? ""));
  return new Map([...raw].map(([name, value]) => [name, resolve(value)]));
})();

const token = (name: string): string => {
  const value = declarations.get(`--mu-${name}`);
  if (!value) throw new Error(`Paper does not set --mu-${name}`);
  return value;
};

// WCAG 2 relative luminance, from sRGB or OKLCH (CSS Color 4 conversion matrices).
const linear = (channel: number): number => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

const luminanceFromRgb = (r: number, g: number, b: number): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

const luminanceFromOklch = (l: number, c: number, hDegrees: number): number => {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  // Linear sRGB already; clamp to the gamut as a browser would.
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl);
};

const luminance = (color: string): number => {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return luminanceFromRgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  const oklch = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (oklch) return luminanceFromOklch(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  throw new Error(`Opaque hex or oklch expected for a text pair, got ${color}`);
};

const contrast = (text: string, background: string): number => {
  const [light, dark] = [luminance(token(text)), luminance(token(background))].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

describe("Paper theme", () => {
  it("sets every theme token", () => {
    expect([...declarations.keys()].sort()).toEqual([...themeTokens].sort());
  });

  it("keeps saved selection distinct from hover and well", () => {
    expect(luminance(token("selected"))).toBeLessThan(luminance(token("hover")));
    expect(luminance(token("selected"))).toBeLessThan(luminance(token("well")));
  });

  it.each(["canvas", "surface"])("keeps control boundaries on %s at 3:1 or more", (background) => {
    expect(contrast("control-edge", background)).toBeGreaterThanOrEqual(3);
  });

  // Every text and background pair color.md's Usage column names keeps 4.5:1 or more.
  it.each([
    ["text", "canvas"],
    ["text", "surface"],
    ["text", "well"],
    ["text", "key"],
    ["text", "hover"],
    ["text", "selected"],
    ["text", "key-hover"],
    ["text-secondary", "canvas"],
    ["text-secondary", "surface"],
    ["text-secondary", "well"],
    ["text-secondary", "key"],
    ["text-secondary", "hover"],
    ["text-secondary", "key-hover"],
    ["text-disabled", "canvas"],
    ["text-disabled", "surface"],
    ["text-disabled", "well"],
    ["text-disabled", "selected"],
    ["on-primary", "primary"],
    ["on-primary", "primary-hover"],
    ["accent", "canvas"],
    ["accent", "surface"],
    ["success", "surface"],
    ["success", "success-soft"],
    ["warning", "surface"],
    ["warning", "warning-soft"],
    ["danger", "surface"],
    ["danger", "danger-soft"],
    ["on-danger", "danger-key"],
  ])("keeps %s on %s at 4.5:1 or more", (text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });
});
