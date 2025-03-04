export type BackgroundType = "none" | "sunset" | "ocean" | "purple" | "mint";

interface BackgroundStyle {
  background: string;
  backgroundSize?: string;
  padding?: string;
}

export interface BackgroundOption {
  value: BackgroundType;
  label: string;
}

// Array of available background options for dynamic rendering
export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { value: "none", label: "exportImage.background.none" },
  { value: "sunset", label: "exportImage.background.sunset" },
  { value: "ocean", label: "exportImage.background.ocean" },
  { value: "purple", label: "exportImage.background.purple" },
  { value: "mint", label: "exportImage.background.mint" },
];

/**
 * Get the CSS style for a specific background type
 * @param type Background type
 * @returns CSS style object
 */
export function getBackgroundStyle(type: BackgroundType): BackgroundStyle {
  switch (type) {
    case "sunset":
      return {
        background: "linear-gradient(140deg, rgb(255, 100, 50) 12.8%, rgb(255, 0, 101) 43.52%, rgb(123, 46, 255) 84.34%)",
        padding: "2rem",
      };
    case "ocean":
      return {
        background: "linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
        padding: "2rem",
      };
    case "purple":
      return {
        background: "linear-gradient(to right, #c471f5 0%, #fa71cd 100%)",
        padding: "2rem",
      };
    case "mint":
      return {
        background: "linear-gradient(to right, #43e97b 0%, #38f9d7 100%)",
        padding: "2rem",
      };
    case "none":
    default:
      return {
        background: "transparent",
        padding: "0",
      };
  }
}
