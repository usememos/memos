import { Monitor, Moon, MoonStar, Palette, Sun, Wallpaper } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadTheme, THEME_OPTIONS } from "@/utils/theme";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
}

const THEME_ICONS: Record<string, JSX.Element> = {
  system: <Monitor className="w-4 h-4" />,
  default: <Sun className="w-4 h-4" />,
  "default-dark": <Moon className="w-4 h-4" />,
  midnight: <MoonStar className="w-4 h-4" />,
  paper: <Palette className="w-4 h-4" />,
  whitewall: <Wallpaper className="w-4 h-4" />,
};

const ThemeSelect = ({ value, onValueChange, className }: ThemeSelectProps = {}) => {
  const currentTheme = value || "system";

  const handleThemeChange = (newTheme: string) => {
    // Apply theme globally immediately
    loadTheme(newTheme);
    // Also notify parent component if callback is provided
    if (onValueChange) {
      onValueChange(newTheme);
    }
  };

  return (
    <Select value={currentTheme} onValueChange={handleThemeChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <SelectValue placeholder="Select theme" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {THEME_ICONS[option.value]}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ThemeSelect;
