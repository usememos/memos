import { Monitor, Moon, Palette, Sun, Wallpaper } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { instanceStore } from "@/store";
import { THEME_OPTIONS } from "@/utils/theme";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
}

const THEME_ICONS: Record<string, JSX.Element> = {
  system: <Monitor className="w-4 h-4" />,
  default: <Sun className="w-4 h-4" />,
  "default-dark": <Moon className="w-4 h-4" />,
  paper: <Palette className="w-4 h-4" />,
  whitewall: <Wallpaper className="w-4 h-4" />,
};

const ThemeSelect = ({ value, onValueChange, className }: ThemeSelectProps = {}) => {
  const currentTheme = value || instanceStore.state.theme || "system";

  const handleThemeChange = (newTheme: Theme) => {
    if (onValueChange) {
      onValueChange(newTheme);
    } else {
      instanceStore.setTheme(newTheme);
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
