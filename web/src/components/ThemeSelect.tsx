import { observer } from "mobx-react-lite";
import { Moon, Palette, Sun, Wallpaper } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workspaceStore, userStore } from "@/store";
import { THEME_OPTIONS } from "@/utils/theme";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
  showEffectiveTheme?: boolean;
}

const THEME_ICONS: Record<string, JSX.Element> = {
  default: <Sun className="w-4 h-4" />,
  "default-dark": <Moon className="w-4 h-4" />,
  paper: <Palette className="w-4 h-4" />,
  whitewall: <Wallpaper className="w-4 h-4" />,
};

const ThemeSelect = observer(({ value, onValueChange, className, showEffectiveTheme = false }: ThemeSelectProps = {}) => {
  const currentTheme = value || workspaceStore.state.theme || "default";
  
  // Calculate effective theme (user preference overrides workspace default)
  const effectiveTheme = userStore.state.userGeneralSetting?.theme || workspaceStore.state.theme || "default";
  
  const displayTheme = showEffectiveTheme ? effectiveTheme : currentTheme;

  const handleThemeChange = (newTheme: Theme) => {
    if (onValueChange) {
      onValueChange(newTheme);
    } else {
      workspaceStore.setTheme(newTheme);
    }
  };

  return (
    <Select value={currentTheme} onValueChange={handleThemeChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <SelectValue placeholder="Select theme" />
          {showEffectiveTheme && effectiveTheme !== currentTheme && (
            <span className="text-xs text-muted-foreground">(effective: {effectiveTheme})</span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {THEME_ICONS[option.value]}
              <span>{option.label}</span>
              {showEffectiveTheme && option.value === effectiveTheme && (
                <span className="text-xs text-green-600">✓</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

export default ThemeSelect;
