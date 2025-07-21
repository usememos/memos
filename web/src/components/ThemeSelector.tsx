import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ThemeSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
}

const THEMES = [
  { value: "default", label: "Default" },
  { value: "paper", label: "Paper" },
  { value: "whitewall", label: "Whitewall" },
] as const;

export const ThemeSelector = ({ value = "default", onValueChange, className }: ThemeSelectorProps) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {THEMES.map((theme) => (
          <SelectItem key={theme.value} value={theme.value}>
            {theme.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ThemeSelector;
