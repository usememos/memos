import { Toggle, ToggleGroup, Tooltip } from "@usememos/ui";
import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Translations } from "@/utils/i18n";
import { loadLocale, useTranslate } from "@/utils/i18n";
import { getInitialTheme, loadTheme, type Theme } from "@/utils/theme";
import { LocalePickerButton } from "./LocalePicker";

const THEMES: { value: Theme; icon: React.ReactElement; labelKey: Translations }[] = [
  { value: "system", icon: <MonitorIcon />, labelKey: "setting.preference.theme-system-short" },
  { value: "default", icon: <SunIcon />, labelKey: "setting.preference.theme-light" },
  { value: "default-dark", icon: <MoonIcon />, labelKey: "setting.preference.theme-dark" },
  { value: "paper", icon: <PaletteIcon />, labelKey: "setting.preference.theme-paper" },
];

interface Props {
  className?: string;
}

/** The auth card's bottom row: the visitor's language and theme, saved on this device until they sign in. */
const AuthFooter = ({ className }: Props) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme());

  const handleThemeChange = (next: Theme) => {
    loadTheme(next);
    setTheme(next);
  };

  return (
    <div className={cn("flex min-h-10 items-center justify-between gap-2 py-2", className)}>
      {/* A ghost button's fill only shows on hover, so its icon, not its edge, lines up with the content. */}
      <div className="-ms-1.5">
        <LocalePickerButton value={i18n.language as Locale} onChange={loadLocale} />
      </div>
      <ToggleGroup
        size="sm"
        aria-label={t("setting.preference.theme")}
        value={[theme]}
        // One theme always stays chosen: pressing the chosen item again keeps it.
        onValueChange={([next]) => next && handleThemeChange(next as Theme)}
      >
        {THEMES.map(({ value, icon, labelKey }) => (
          <Tooltip.Root key={value}>
            <Tooltip.Trigger render={<Toggle value={value} icon={icon} aria-label={t(labelKey)} />} />
            <Tooltip.Popup>{t(labelKey)}</Tooltip.Popup>
          </Tooltip.Root>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default AuthFooter;
