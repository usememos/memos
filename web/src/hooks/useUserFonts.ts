import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFontWithFallback, loadFonts } from "@/utils/font";

/**
 * Hook that reactively applies the user's UI + code font preferences.
 * Priority: user setting -> localStorage -> theme default.
 */
export const useUserFonts = () => {
  const { userGeneralSetting } = useAuth();

  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }
    const uiFont = getFontWithFallback(userGeneralSetting.uiFont, "ui");
    const codeFont = getFontWithFallback(userGeneralSetting.codeFont, "code");
    loadFonts(uiFont, codeFont);
  }, [userGeneralSetting?.uiFont, userGeneralSetting?.codeFont]);
};
