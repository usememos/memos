import defaultDarkThemeContent from "../themes/default-dark.css?raw";
import paperThemeContent from "../themes/paper.css?raw";
import whitewallThemeContent from "../themes/whitewall.css?raw";

const VALID_THEMES = ["default", "default-dark", "paper", "whitewall"] as const;
type ValidTheme = (typeof VALID_THEMES)[number];

const THEME_CONTENT: Record<ValidTheme, string | null> = {
  default: null,
  "default-dark": defaultDarkThemeContent,
  paper: paperThemeContent,
  whitewall: whitewallThemeContent,
};

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

  // Fall back to system preference
  return getSystemTheme();
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

  // Remove existing theme
  document.getElementById("workspace-theme")?.remove();

  // Apply theme (skip for default)
  if (validTheme !== "default") {
    const css = THEME_CONTENT[validTheme];
    if (css) {
      const style = document.createElement("style");
      style.id = "workspace-theme";
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  // Set data attribute
  document.documentElement.setAttribute("data-theme", validTheme);

  // Store theme preference for future loads
  try {
    localStorage.setItem("memos-theme", validTheme);
  } catch {
    // localStorage might not be available
  }
};
