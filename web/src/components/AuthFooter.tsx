import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { loadLocale } from "@/utils/i18n";
import { getInitialTheme, loadTheme, Theme } from "@/utils/theme";
import LocaleSelect from "./LocaleSelect";
import ThemeSelect from "./ThemeSelect";

interface Props {
  className?: string;
}

const AuthFooter = ({ className }: Props) => {
  const { i18n: i18nInstance } = useTranslation();
  const currentLocale = i18nInstance.language as Locale;
  const [currentTheme, setCurrentTheme] = useState(getInitialTheme());

  const handleLocaleChange = (locale: Locale) => {
    loadLocale(locale);
  };

  const handleThemeChange = (theme: string) => {
    loadTheme(theme);
    setCurrentTheme(theme as Theme);
  };

  return (
    <div className={cn("mt-4 flex flex-row items-center justify-center w-full gap-2", className)}>
      <LocaleSelect value={currentLocale} onChange={handleLocaleChange} />
      <ThemeSelect value={currentTheme} onValueChange={handleThemeChange} />
    </div>
  );
};

export default AuthFooter;
