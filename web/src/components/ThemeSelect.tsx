import { Moon, Palette, Sun, Wallpaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  const currentThemeOption = themeOptions.find((option) => option.value === currentTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`justify-start ${className || ""}`}>
          {currentThemeOption?.icon}
          <span className="ml-2">{currentThemeOption?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {themeOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => handleThemeChange(option.value)}>
            {option.icon}
            <span className="ml-2">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSelect;
