import { observer } from "mobx-react-lite";
import { Info } from "lucide-react";
import { userStore, workspaceStore } from "@/store";

const ThemeInfoCard = observer(() => {
  const userTheme = userStore.state.userGeneralSetting?.theme;
  const workspaceTheme = workspaceStore.state.theme || "default";
  const effectiveTheme = userTheme || workspaceTheme;

  return (
    <div className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="space-y-2">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Theme System</h4>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p><strong>Current effective theme:</strong> {effectiveTheme}</p>
            <p><strong>Workspace default:</strong> {workspaceTheme}</p>
            {userTheme && (
              <p><strong>Your preference:</strong> {userTheme}</p>
            )}
            <p className="text-xs mt-2">
              Your personal theme preference overrides the workspace default. 
              If you haven't set a personal preference, the workspace default is used.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ThemeInfoCard;