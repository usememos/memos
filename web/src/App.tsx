import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useInstance } from "./contexts/InstanceContext";
import { TimelineViewProvider } from "./contexts/ViewContext";
import useNavigateTo from "./hooks/useNavigateTo";
import { useUserLocale } from "./hooks/useUserLocale";
import { useUserTheme } from "./hooks/useUserTheme";
import { DEFAULT_FAVICON, getCustomLogoUrl } from "./lib/branding";
import { cleanupExpiredOAuthState } from "./utils/oauth";

const App = () => {
  const navigateTo = useNavigateTo();
  const { profile: instanceProfile, profileLoaded, generalSetting: instanceGeneralSetting } = useInstance();

  // Apply user preferences reactively
  const direction = useUserLocale();
  useUserTheme();

  // Clean up expired OAuth states on app initialization
  useEffect(() => {
    cleanupExpiredOAuthState();
  }, []);

  // Redirect to sign up page if the instance needs initial setup (no users yet).
  // needsSetup is used instead of a missing admin so an instance that has lost its
  // admins isn't mistaken for a fresh install (which would create a normal user).
  // Guard with profileLoaded so a fetch failure doesn't incorrectly trigger the redirect.
  useEffect(() => {
    if (profileLoaded && instanceProfile.needsSetup) {
      navigateTo("/auth/signup");
    }
  }, [profileLoaded, instanceProfile.needsSetup, navigateTo]);

  useEffect(() => {
    if (instanceGeneralSetting.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = instanceGeneralSetting.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
  }, [instanceGeneralSetting.additionalStyle]);

  useEffect(() => {
    if (instanceGeneralSetting.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = instanceGeneralSetting.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [instanceGeneralSetting.additionalScript]);

  // Dynamic update metadata with customized profile
  useEffect(() => {
    const customProfile = instanceGeneralSetting.customProfile;
    document.title = customProfile?.title || "Memos";
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) return;

    const logoUrl = getCustomLogoUrl(customProfile?.logoUrl);
    if (logoUrl) {
      link.href = logoUrl;
      // Custom images may be PNG, JPEG, or SVG; let the browser detect their type.
      link.removeAttribute("type");
      return;
    }

    // A fixed blue stays visible when browser chrome differs from the system theme.
    link.href = DEFAULT_FAVICON;
    link.type = "image/svg+xml";
  }, [instanceGeneralSetting.customProfile]);

  return (
    <DirectionProvider direction={direction}>
      <TimelineViewProvider>
        <Outlet />
      </TimelineViewProvider>
      <ScrollRestoration />
    </DirectionProvider>
  );
};

export default App;
