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
};
