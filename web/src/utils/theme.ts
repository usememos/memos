import type { Translations } from "@/utils/i18n";

// ============================================================================
// Types and Constants
// ============================================================================

/** The saved preference: the account setting `theme` and localStorage keep these values. */
const VALID_THEMES = ["system", "default", "default-dark", "paper"] as const;

export type Theme = (typeof VALID_THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

/** The `data-theme` value on <html>: `light` and `dark` are @usememos/ui's themes, `paper` is memos' own. */
export type Appearance = "light" | "dark" | "paper";

export interface ThemeOption {
  value: string;
  labelKey: Translations;
}

const STORAGE_KEY = "memos-theme";

const APPEARANCES: Record<ResolvedTheme, Appearance> = {
  default: "light",
  "default-dark": "dark",
  paper: "paper",
};

/** Each theme's canvas, for the browser chrome on phones; the values in index.html match. */
const THEME_COLORS: Record<Appearance, string> = {
  light: "#fafafa",
  dark: "#0f0f0f",
  paper: "#f5ede4",
};

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "system", labelKey: "setting.preference.theme-system" },
  { value: "default", labelKey: "setting.preference.theme-light" },
  { value: "default-dark", labelKey: "setting.preference.theme-dark" },
  { value: "paper", labelKey: "setting.preference.theme-paper" },
];

// ============================================================================
// Theme Validation and Detection
// ============================================================================

/**
 * Validates and normalizes a theme string to a valid theme.
 * Falls back to "default" (Light) for unknown values.
 */
const validateTheme = (theme: string): Theme => {
  return VALID_THEMES.includes(theme as Theme) ? (theme as Theme) : "default";
};

/**
 * Detects the system's preferred color scheme.
 * @returns "default-dark" for dark mode, "default" for light mode
 */
export const getSystemTheme = (): ResolvedTheme => {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "default-dark";
  }
  return "default";
};

/**
 * Resolves "system" theme to the actual theme based on OS preference.
 * Other themes are returned as-is after validation.
 */
export const resolveTheme = (theme: string): ResolvedTheme => {
  const validTheme = validateTheme(theme);
  return validTheme === "system" ? getSystemTheme() : validTheme;
};

/** The `data-theme` value a resolved theme selects. */
const toAppearance = (theme: ResolvedTheme): Appearance => APPEARANCES[theme];

export const isDarkTheme = (theme: ResolvedTheme): boolean => toAppearance(theme) === "dark";

// ============================================================================
// LocalStorage Helpers
// ============================================================================

/**
 * Safely reads the theme from localStorage.
 * @returns The stored theme, or null if not found or unavailable
 */
const getStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && VALID_THEMES.includes(stored as Theme) ? (stored as Theme) : null;
  } catch {
    return null;
  }
};

/**
 * Safely stores the theme to localStorage.
 */
const setStoredTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage might not be available (SSR, private browsing, etc.)
  }
};

// ============================================================================
// Theme Selection with Fallbacks
// ============================================================================

/**
 * Gets the theme for initial page load (before user settings are available).
 * Priority: localStorage -> system preference
 */
export const getInitialTheme = (): Theme => {
  return getStoredTheme() ?? "system";
};

/**
 * Gets the theme with full fallback chain.
 * Priority:
 * 1. User setting (if logged in and has preference)
 * 2. localStorage (from previous session)
 * 3. System preference
 */
export const getThemeWithFallback = (userTheme?: string): Theme => {
  // Priority 1: User setting
  if (userTheme && VALID_THEMES.includes(userTheme as Theme)) {
    return userTheme as Theme;
  }

  // Priority 2: localStorage
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }

  // Priority 3: System preference
  return "system";
};

// ============================================================================
// DOM Manipulation
// ============================================================================

/**
 * Sets the data-theme attribute on the document element. The stylesheets select the
 * tokens and the `color-scheme` from it, and popups portaled to <body> inherit them.
 */
const setThemeAttribute = (appearance: Appearance): void => {
  document.documentElement.setAttribute("data-theme", appearance);
};

/**
 * Updates the theme-color meta tag to match the current theme background.
 * This colors the browser/status bar on mobile devices.
 */
const updateThemeColorMeta = (theme: Theme): void => {
  const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
  const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');

  if (theme === "system") {
    if (lightMeta) {
      lightMeta.content = THEME_COLORS.light;
    }
    if (darkMeta) {
      darkMeta.content = THEME_COLORS.dark;
    }
    return;
  }

  const color = THEME_COLORS[toAppearance(resolveTheme(theme))];
  if (lightMeta) {
    lightMeta.content = color;
  }
  if (darkMeta) {
    darkMeta.content = color;
  }
};

// ============================================================================
// Main Theme Loading
// ============================================================================

/**
 * Loads and applies a theme.
 * This function:
 * 1. Validates the theme
 * 2. Resolves "system" to actual theme
 * 3. Sets data-theme attribute
 * 4. Updates browser native UI colors
 * 5. Persists to localStorage
 */
export const loadTheme = (themeName: string): void => {
  const validTheme = validateTheme(themeName);
  const resolvedTheme = resolveTheme(validTheme);

  setThemeAttribute(toAppearance(resolvedTheme));
  updateThemeColorMeta(validTheme);
  setStoredTheme(validTheme); // Store original theme preference (not resolved)
};

/**
 * Applies theme early during initial page load to prevent FOUC.
 * Uses only localStorage and system preference (no user settings yet).
 */
export const applyThemeEarly = (): void => {
  const theme = getInitialTheme();
  loadTheme(theme);
};

// ============================================================================
// System Theme Listener
// ============================================================================

/**
 * Sets up a listener for OS-level theme preference changes.
 * Supports both modern (addEventListener) and legacy (addListener) APIs.
 *
 * @param onThemeChange - Callback invoked when system theme changes
 * @returns Cleanup function to remove the listener
 */
export const setupSystemThemeListener = (onThemeChange: () => void): (() => void) => {
  // Guard against SSR
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Modern API (preferred)
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", onThemeChange);
    return () => mediaQuery.removeEventListener("change", onThemeChange);
  }

  // Legacy API (Safari < 14)
  if (mediaQuery.addListener) {
    mediaQuery.addListener(onThemeChange);
    return () => mediaQuery.removeListener(onThemeChange);
  }

  return () => {};
};
