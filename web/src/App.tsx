import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useInstance } from "./contexts/InstanceContext";
import { MemoFilterProvider } from "./contexts/MemoFilterContext";
import { useUserLocale } from "./hooks/useUserLocale";
import { useUserTheme } from "./hooks/useUserTheme";

const App = () => {
  const { generalSetting: instanceGeneralSetting } = useInstance();

  // Apply user preferences reactively
  useUserLocale();
  useUserTheme();

  // No setup flow: users are auto-provisioned from Cloudflare Access on
  // first sign-in, and the first ADMIN comes from the ADMIN_EMAILS var.

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
    if (!instanceGeneralSetting.customProfile) {
      return;
    }

    document.title = instanceGeneralSetting.customProfile.title;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = instanceGeneralSetting.customProfile.logoUrl || "/logo.webp";
  }, [instanceGeneralSetting.customProfile]);

  return (
    <>
      <MemoFilterProvider>
        <Outlet />
      </MemoFilterProvider>
      <ScrollRestoration />
    </>
  );
};

export default App;
