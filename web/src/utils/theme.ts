const VALID_THEMES = ["default", "paper"] as const;
type ValidTheme = (typeof VALID_THEMES)[number];

// Validate theme name and return default if invalid
export const validateTheme = (theme: string): ValidTheme => {
  return VALID_THEMES.includes(theme as ValidTheme) ? (theme as ValidTheme) : "default";
};

// Get theme from localStorage
export const getStoredTheme = (): ValidTheme => {
  try {
    const stored = localStorage.getItem("workspace-theme");
    return stored ? validateTheme(stored) : "default";
  } catch {
    return "default";
  }
};

// Save theme to localStorage
export const storeTheme = (theme: string): void => {
  try {
    const validTheme = validateTheme(theme);
    localStorage.setItem("workspace-theme", validTheme);
  } catch {
    // Silently fail if localStorage is not available
  }
};

// Load theme immediately from localStorage to prevent flickering
export const loadStoredThemeSync = (): void => {
  const theme = getStoredTheme();
  // Apply theme synchronously to prevent flash
  document.documentElement.setAttribute("data-theme", theme);
};

// Async theme loader
export const loadTheme = async (themeName: string): Promise<void> => {
  const validTheme = validateTheme(themeName);

  // Store theme for next page load
  storeTheme(validTheme);

  // Remove existing theme
  const existingTheme = document.getElementById("workspace-theme");
  if (existingTheme) {
    existingTheme.remove();
  }

  try {
    // Load theme CSS
    const response = await fetch(`/themes/${validTheme}.css`);
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${response.status}`);
    }

    const css = await response.text();

    // Apply theme
    const styleElement = document.createElement("style");
    styleElement.id = "workspace-theme";
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // Update data attribute
    document.documentElement.setAttribute("data-theme", validTheme);
  } catch (error) {
    console.error("Failed to load theme:", error);

    // Fallback to default theme if current theme fails
    if (validTheme !== "default") {
      await loadTheme("default");
    }
  }
};
