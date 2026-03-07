import defaultDarkThemeContent from "../themes/default-dark.css?raw";
import paperThemeContent from "../themes/paper.css?raw";

// ============================================================================
// Types and Constants
// ============================================================================

const VALID_THEMES = ["system", "default", "default-dark", "paper"] as const;

export type Theme = (typeof VALID_THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export interface ThemeOption {
  value: string;
  label: string;
}

const STORAGE_KEY = "memos-theme";
const STYLE_ELEMENT_ID = "instance-theme";

const THEME_CONTENT: Record<ResolvedTheme, string | null> = {
  default: null,
  "default-dark": defaultDarkThemeContent,
  paper: paperThemeContent,
};

const THEME_COLORS: Record<ResolvedTheme, string> = {
  default: "#faf9f5",
  "default-dark": "#020204",
  paper: "#f5ede4",
};

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "system", label: "Sync with system" },
  { value: "default", label: "Light" },
  { value: "default-dark", label: "Dark" },
  { value: "paper", label: "Paper" },
];

// ============================================================================
// Theme Validation and Detection
// ============================================================================

/**
 * Validates and normalizes a theme string to a valid theme.
 * Falls back to "default" for invalid themes.
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
 * Removes the existing theme style element from the DOM.
 */
const removeThemeStyle = (): void => {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
};

/**
 * Injects theme CSS into the document head.
 * Skips injection for the default theme (uses base CSS).
 */
const injectThemeStyle = (theme: ResolvedTheme): void => {
  removeThemeStyle();

  if (theme === "default") {
    return; // Use base CSS for default theme
  }

  const css = THEME_CONTENT[theme];
  if (css) {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
};

/**
 * Sets the data-theme attribute on the document element.
 * This allows CSS to react to the current theme.
 */
const setThemeAttribute = (theme: ResolvedTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
};

/**
 * Updates the theme-color meta tag to match the current theme background.
 * This colors the browser/status bar on mobile devices.
 */
const updateThemeColorMeta = (theme: ResolvedTheme): void => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = THEME_COLORS[theme];
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
 * 3. Injects theme CSS
 * 4. Sets data-theme attribute
 * 5. Persists to localStorage
 */
export const loadTheme = (themeName: string): void => {
  const validTheme = validateTheme(themeName);
  const resolvedTheme = resolveTheme(validTheme);

  injectThemeStyle(resolvedTheme);
  setThemeAttribute(resolvedTheme);
  updateThemeColorMeta(resolvedTheme);
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
