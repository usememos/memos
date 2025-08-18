import { Moon, Palette, Sun, Wallpaper } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workspaceStore } from "@/store";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
}

const ThemeSelect = ({ value, onValueChange, className }: ThemeSelectProps = {}) => {
  const currentTheme = value || workspaceStore.state.theme || "default";

  const themeOptions: { value: Theme; icon: JSX.Element; label: string }[] = [
    { value: "default", icon: <Sun className="w-4 h-4" />, label: "Default Light" },
    { value: "default-dark", icon: <Moon className="w-4 h-4" />, label: "Default Dark" },
    { value: "paper", icon: <Palette className="w-4 h-4" />, label: "Paper" },
    { value: "whitewall", icon: <Wallpaper className="w-4 h-4" />, label: "Whitewall" },
  ];

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
        </div>
      </SelectTrigger>
      <SelectContent>
        {themeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ThemeSelect;
