import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSystemTheme, getThemeWithFallback, type ResolvedTheme, resolveTheme, setupSystemThemeListener } from "@/utils/theme";

/** The theme actually in effect: the user's setting, or the OS scheme while that setting is "system". */
export const useResolvedTheme = (): ResolvedTheme => {
  const { userGeneralSetting } = useAuth();
  const theme = getThemeWithFallback(userGeneralSetting?.theme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  useEffect(() => {
    if (theme !== "system") return;
    return setupSystemThemeListener(() => setSystemTheme(getSystemTheme()));
  }, [theme]);
  return theme === "system" ? systemTheme : resolveTheme(theme);
};
