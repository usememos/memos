import { Select } from "@usememos/ui";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslate } from "@/utils/i18n";
import { loadTheme, THEME_OPTIONS } from "@/utils/theme";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (theme: string) => void;
  className?: string;
  compact?: boolean;
}

const THEME_ICONS: Record<string, ReactElement> = {
  system: <Monitor className="mu-icon" />,
  default: <Sun className="mu-icon" />,
  "default-dark": <Moon className="mu-icon" />,
  paper: <Palette className="mu-icon" />,
};

const ThemeSelect = ({ value, onValueChange, className, compact = false }: ThemeSelectProps = {}) => {
  const t = useTranslate();
  const currentTheme = value || "system";
  const options = THEME_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }));
  const triggerLabel =
    currentTheme === "system" ? t("setting.preference.theme-system-short") : options.find((option) => option.value === currentTheme)?.label;

  const handleThemeChange = (newTheme: string) => {
    // Apply theme globally immediately
    loadTheme(newTheme);
    // Also notify parent component if callback is provided
    if (onValueChange) {
      onValueChange(newTheme);
    }
  };

  return (
    <Select.Root value={currentTheme} items={options} onValueChange={(value) => value !== null && handleThemeChange(value)}>
      <Select.Trigger className={className}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {compact && THEME_ICONS[currentTheme]}
          {compact ? <span className="truncate">{triggerLabel}</span> : <Select.Value className="truncate" />}
        </div>
      </Select.Trigger>
      <Select.Popup>
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value} icon={THEME_ICONS[option.value]}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  );
};

export default ThemeSelect;
