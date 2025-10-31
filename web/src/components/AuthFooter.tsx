import { observer } from "mobx-react-lite";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { workspaceStore } from "@/store";
import { loadTheme } from "@/utils/theme";
import LocaleSelect from "./LocaleSelect";
import ThemeSelect from "./ThemeSelect";

interface Props {
  className?: string;
}

const AuthFooter = observer(({ className }: Props) => {
  // Local state for login page theme since we can't persist to server
  const [localTheme, setLocalTheme] = useState(workspaceStore.state.theme || "default");

  const handleThemeChange = (theme: string) => {
    // Update local state
    setLocalTheme(theme);
    // Update workspace store for immediate UI feedback
    workspaceStore.state.setPartial({ theme });
    // Apply theme to DOM
    loadTheme(theme);
  };

  return (
    <div className={cn("mt-4 flex flex-row items-center justify-center w-full gap-2", className)}>
      <LocaleSelect value={workspaceStore.state.locale} onChange={(locale) => workspaceStore.state.setPartial({ locale })} />
      <ThemeSelect value={localTheme} onValueChange={handleThemeChange} />
    </div>
  );
});

export default AuthFooter;
