import { Monitor, Moon, Palette, Sun } from "lucide-react";
import type { ReactElement } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadTheme, THEME_OPTIONS } from "@/utils/theme";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
  compact?: boolean;
}

const THEME_ICONS: Record<string, ReactElement> = {
  system: <Monitor className="w-4 h-4" />,
  default: <Sun className="w-4 h-4" />,
  "default-dark": <Moon className="w-4 h-4" />,
  paper: <Palette className="w-4 h-4" />,
};

const ThemeSelect = ({ value, onValueChange, className, compact = false }: ThemeSelectProps = {}) => {
  const currentTheme = value || "system";
  const triggerLabel = currentTheme === "system" ? "System" : THEME_OPTIONS.find((option) => option.value === currentTheme)?.label;

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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {compact && THEME_ICONS[currentTheme]}
          {compact ? <span className="truncate">{triggerLabel}</span> : <SelectValue className="truncate" placeholder="Select theme" />}
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
