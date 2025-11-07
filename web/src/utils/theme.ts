import defaultDarkThemeContent from "../themes/default-dark.css?raw";
import paperThemeContent from "../themes/paper.css?raw";
import whitewallThemeContent from "../themes/whitewall.css?raw";

const VALID_THEMES = ["system", "default", "default-dark", "paper", "whitewall"] as const;
type ValidTheme = (typeof VALID_THEMES)[number];

const THEME_CONTENT: Record<ValidTheme, string | null> = {
  system: null, // System theme dynamically chooses between default and default-dark
  default: null,
  "default-dark": defaultDarkThemeContent,
  paper: paperThemeContent,
  whitewall: whitewallThemeContent,
};

export interface ThemeOption {
  value: string;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "system", label: "Sync with system" },
  { value: "default", label: "Light" },
  { value: "default-dark", label: "Dark" },
  { value: "paper", label: "Paper" },
  { value: "whitewall", label: "Whitewall" },
];

const validateTheme = (theme: string): ValidTheme => {
  return VALID_THEMES.includes(theme as ValidTheme) ? (theme as ValidTheme) : "default";
};

/**
 * Detects system theme preference
 */
export const getSystemTheme = (): "default" | "default-dark" => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "default-dark" : "default";
  }
  return "default";
};

/**
 * Resolves the actual theme to apply based on user preference
 * If theme is "system", returns the system preference, otherwise returns the theme as-is
 */
export const resolveTheme = (theme: string): "default" | "default-dark" | "paper" | "whitewall" => {
  if (theme === "system") {
    return getSystemTheme();
  }
  const validTheme = validateTheme(theme);
  return validTheme === "system" ? getSystemTheme() : validTheme;
};

/**
 * Gets the theme that should be applied on initial load
 * Priority: stored user preference -> system preference -> default
 */
export const getInitialTheme = (): ValidTheme => {
  // Try to get stored theme from localStorage (where user settings might be cached)
  try {
    const storedTheme = localStorage.getItem("memos-theme");
    if (storedTheme && VALID_THEMES.includes(storedTheme as ValidTheme)) {
      return storedTheme as ValidTheme;
    }
  } catch {
    // localStorage might not be available
  }

  // Fall back to system preference (return "system" to enable auto-switching)
  return "system";
};

/**
 * Applies the theme early to prevent flash of wrong theme
 */
export const applyThemeEarly = (): void => {
  const theme = getInitialTheme();
  loadTheme(theme);
};

export const loadTheme = (themeName: string): void => {
  const validTheme = validateTheme(themeName);

  // Resolve "system" to actual theme based on OS preference
  const resolvedTheme = resolveTheme(validTheme);

  // Remove existing theme
  document.getElementById("instance-theme")?.remove();

  // Apply theme (skip for default)
  if (resolvedTheme !== "default") {
    const css = THEME_CONTENT[resolvedTheme];
    if (css) {
      const style = document.createElement("style");
      style.id = "instance-theme";
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  // Set data attribute with resolved theme
  document.documentElement.setAttribute("data-theme", resolvedTheme);

  // Store theme preference (original, not resolved) for future loads
  try {
    localStorage.setItem("memos-theme", validTheme);
  } catch {
    // localStorage might not be available
  }
};

/**
 * Sets up a listener for system theme preference changes
 * Returns a cleanup function to remove the listener
 */
export const setupSystemThemeListener = (onThemeChange: () => void): (() => void) => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {}; // No-op cleanup
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Handle theme change
  const handleChange = () => {
    onThemeChange();
  };

  // Modern API (addEventListener)
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  // Legacy API (addListener) - for older browsers
  if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }

  return () => {}; // No-op cleanup
};
