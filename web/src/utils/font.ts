// Font selection & loading utilities.
//
// Fonts are sourced from Google Fonts via a single <link rel="stylesheet">
// pointing at fonts.googleapis.com. No API key is required — Google's CSS
// endpoint is public. The user picks two families (UI + code) from a curated
// list of popular options, or enters a custom Google Fonts family name.
//
// The selected families are layered in front of the existing
// --font-sans / --font-mono CSS variables so the rest of the design system
// (system-ui fallbacks, emoji fonts, etc.) keeps working when a font fails
// to load.

const UI_FONT_STORAGE_KEY = "memos-ui-font";
const CODE_FONT_STORAGE_KEY = "memos-code-font";
const LINK_ELEMENT_ID = "memos-google-fonts";
const STYLE_ELEMENT_ID = "memos-user-fonts";

export interface FontOption {
  // Empty string represents the theme default (no Google Font is loaded).
  value: string;
  label: string;
}

// Popular sans-serif UI families on Google Fonts.
export const UI_FONT_OPTIONS: FontOption[] = [
  { value: "", label: "System default" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Nunito", label: "Nunito" },
  { value: "Source Sans 3", label: "Source Sans 3" },
  { value: "Work Sans", label: "Work Sans" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans" },
  { value: "IBM Plex Sans", label: "IBM Plex Sans" },
  { value: "Manrope", label: "Manrope" },
  { value: "Outfit", label: "Outfit" },
  { value: "Bricolage Grotesque", label: "Bricolage Grotesque" },
  { value: "Lora", label: "Lora (serif)" },
  { value: "Merriweather", label: "Merriweather (serif)" },
];

// Popular monospaced families on Google Fonts.
export const CODE_FONT_OPTIONS: FontOption[] = [
  { value: "", label: "System default" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "Source Code Pro", label: "Source Code Pro" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Roboto Mono", label: "Roboto Mono" },
  { value: "Space Mono", label: "Space Mono" },
  { value: "Inconsolata", label: "Inconsolata" },
  { value: "Ubuntu Mono", label: "Ubuntu Mono" },
  { value: "Cascadia Code", label: "Cascadia Code" },
  { value: "Recursive", label: "Recursive" },
  { value: "Geist Mono", label: "Geist Mono" },
];

// Google Fonts family names use ASCII letters, digits, spaces, hyphens,
// periods, and plus signs (e.g. "M PLUS 1"). Reject anything else so a
// custom value can't smuggle CSS or URL syntax into the <link>/<style> we
// inject.
const FAMILY_PATTERN = /^[A-Za-z0-9 .\-+]{1,64}$/;

const normalizeFamily = (raw: string): string => raw.trim().replace(/\s+/g, " ");

const isValidFamily = (family: string): boolean => family !== "" && FAMILY_PATTERN.test(family);

const cssFamily = (family: string): string => `"${family.replace(/"/g, "")}"`;

const buildGoogleFontsHref = (families: string[]): string | null => {
  const valid = Array.from(new Set(families.filter(isValidFamily)));
  if (valid.length === 0) {
    return null;
  }
  // Request a couple of weights so headings + body both look right.
  const params = valid.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

const upsertLink = (href: string | null) => {
  const existing = document.getElementById(LINK_ELEMENT_ID) as HTMLLinkElement | null;
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing) {
    if (existing.href !== href) {
      existing.href = href;
    }
    return;
  }
  const link = document.createElement("link");
  link.id = LINK_ELEMENT_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

const upsertOverrideStyle = (uiFont: string, codeFont: string) => {
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  const declarations: string[] = [];
  if (isValidFamily(uiFont)) {
    declarations.push(`--font-sans: ${cssFamily(uiFont)}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;`);
  }
  if (isValidFamily(codeFont)) {
    declarations.push(`--font-mono: ${cssFamily(codeFont)}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;`);
  }

  if (declarations.length === 0) {
    existing?.remove();
    return;
  }

  const css = `:root { ${declarations.join(" ")} }`;
  if (existing) {
    if (existing.textContent !== css) {
      existing.textContent = css;
    }
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
};

const safeStorageGet = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const safeStorageSet = (key: string, value: string) => {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable (SSR, private browsing).
  }
};

/**
 * Applies the given UI + code font selections to the document.
 * Empty string means "use the theme default" for either slot.
 * Persists the choice to localStorage for early-load reuse.
 */
export const loadFonts = (uiFontRaw: string, codeFontRaw: string): void => {
  const uiFont = normalizeFamily(uiFontRaw);
  const codeFont = normalizeFamily(codeFontRaw);

  upsertLink(buildGoogleFontsHref([uiFont, codeFont]));
  upsertOverrideStyle(uiFont, codeFont);

  safeStorageSet(UI_FONT_STORAGE_KEY, isValidFamily(uiFont) ? uiFont : "");
  safeStorageSet(CODE_FONT_STORAGE_KEY, isValidFamily(codeFont) ? codeFont : "");
};

/**
 * Resolves the font preference with full fallback chain:
 * 1. User setting (when logged in)
 * 2. localStorage (last applied value)
 * 3. Empty string (use theme default)
 */
export const getFontWithFallback = (userFont: string | undefined, kind: "ui" | "code"): string => {
  if (userFont && isValidFamily(userFont)) {
    return userFont;
  }
  const stored = safeStorageGet(kind === "ui" ? UI_FONT_STORAGE_KEY : CODE_FONT_STORAGE_KEY);
  return isValidFamily(stored) ? stored : "";
};

/**
 * Applies the stored font preference early in page load to avoid a flash of
 * the wrong typeface. Called before React mounts.
 */
export const applyFontsEarly = (): void => {
  loadFonts(safeStorageGet(UI_FONT_STORAGE_KEY), safeStorageGet(CODE_FONT_STORAGE_KEY));
};

/**
 * Validates a Google Fonts family name supplied by the user.
 * Returns true for the empty string (= reset to default) as well.
 */
export const isFontFamilyValid = (family: string): boolean => {
  const normalized = normalizeFamily(family);
  return normalized === "" || FAMILY_PATTERN.test(normalized);
};
