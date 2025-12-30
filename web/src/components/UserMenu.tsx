import { ArchiveIcon, CheckIcon, GlobeIcon, LogOutIcon, PaletteIcon, SettingsIcon, SquareUserIcon, User2Icon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { getLocaleDisplayName, getLocaleWithFallback, loadLocale, useTranslate } from "@/utils/i18n";
import { getThemeWithFallback, loadTheme, THEME_OPTIONS } from "@/utils/theme";
import UserAvatar from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Props {
  collapsed?: boolean;
}

const UserMenu = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const { userGeneralSetting, refetchSettings, logout } = useAuth();
  const { mutate: updateUserGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);
  const currentLocale = getLocaleWithFallback(userGeneralSetting?.locale);
  const currentTheme = getThemeWithFallback(userGeneralSetting?.theme);

  const handleLocaleChange = async (locale: Locale) => {
    if (!currentUser) return;
    // Apply locale immediately for instant UI feedback and persist to localStorage
    loadLocale(locale);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { locale }, updateMask: ["locale"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleThemeChange = async (theme: string) => {
    if (!currentUser) return;
    // Apply theme immediately for instant UI feedback
    loadTheme(theme);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { theme }, updateMask: ["theme"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleSignOut = async () => {
    // First, clear auth state and cache BEFORE doing anything else
    await logout();

    try {
      // Then clear user-specific localStorage items
      // Preserve app-wide settings (theme, locale, view preferences, tag view settings)
      const keysToPreserve = ["memos-theme", "memos-locale", "memos-view-setting", "tag-view-as-tree", "tag-tree-auto-expand"];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToPreserve.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore errors from localStorage operations
    }

    // Always redirect to auth page (use replace to prevent back navigation)
    window.location.replace(Routes.AUTH);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!currentUser}>
        <div className={cn("w-auto flex flex-row justify-start items-center cursor-pointer text-foreground", collapsed ? "px-1" : "px-3")}>
          {currentUser?.avatarUrl ? (
            <UserAvatar className="shrink-0" avatarUrl={currentUser?.avatarUrl} />
          ) : (
            <User2Icon className="w-6 mx-auto h-auto text-muted-foreground" />
          )}
          {!collapsed && (
            <span className="ml-2 text-lg font-medium text-foreground grow truncate">
              {currentUser?.displayName || currentUser?.username}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => navigateTo(`/u/${encodeURIComponent(currentUser?.username ?? "")}`)}>
          <SquareUserIcon className="size-4 text-muted-foreground" />
          {t("common.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigateTo(Routes.ARCHIVED)}>
          <ArchiveIcon className="size-4 text-muted-foreground" />
          {t("common.archived")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GlobeIcon className="size-4 text-muted-foreground" />
            {t("common.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[90vh] overflow-y-auto">
            {locales.map((locale) => (
              <DropdownMenuItem key={locale} onClick={() => handleLocaleChange(locale)}>
                {currentLocale === locale && <CheckIcon className="w-4 h-auto" />}
                {currentLocale !== locale && <span className="w-4" />}
                {getLocaleDisplayName(locale)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon className="size-4 text-muted-foreground" />
            {t("setting.preference-section.theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.value} onClick={() => handleThemeChange(option.value)}>
                {currentTheme === option.value && <CheckIcon className="w-4 h-auto" />}
                {currentTheme !== option.value && <span className="w-4" />}
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => navigateTo(Routes.SETTING)}>
          <SettingsIcon className="size-4 text-muted-foreground" />
          {t("common.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon className="size-4 text-muted-foreground" />
          {t("common.sign-out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
