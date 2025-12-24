import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { ArchiveIcon, CheckIcon, GlobeIcon, LogOutIcon, PaletteIcon, SettingsIcon, SquareUserIcon, User2Icon } from "lucide-react";
import { userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import i18n, { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserSetting_GeneralSettingSchema, UserSettingSchema } from "@/types/proto/api/v1/user_service_pb";
import { getLocaleDisplayName, useTranslate } from "@/utils/i18n";
import { loadTheme, THEME_OPTIONS } from "@/utils/theme";
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
  const currentLocale = userGeneralSetting?.locale || "en";
  const currentTheme = userGeneralSetting?.theme || "default";

  const handleLocaleChange = async (locale: Locale) => {
    if (!currentUser) return;
    // Apply locale immediately for instant UI feedback
    i18n.changeLanguage(locale);
    // Persist to user settings
    const settingName = `${currentUser.name}/setting`;
    const updatedGeneralSetting = create(UserSetting_GeneralSettingSchema, {
      locale,
      theme: userGeneralSetting?.theme,
      memoVisibility: userGeneralSetting?.memoVisibility,
    });
    await userServiceClient.updateUserSetting({
      setting: create(UserSettingSchema, {
        name: settingName,
        value: {
          case: "generalSetting",
          value: updatedGeneralSetting,
        },
      }),
      updateMask: create(FieldMaskSchema, { paths: ["general_setting.locale"] }),
    });
    await refetchSettings();
  };

  const handleThemeChange = async (theme: string) => {
    if (!currentUser) return;
    // Apply theme immediately for instant UI feedback
    loadTheme(theme);
    // Persist to user settings
    const settingName = `${currentUser.name}/setting`;
    const updatedGeneralSetting = create(UserSetting_GeneralSettingSchema, {
      locale: userGeneralSetting?.locale,
      theme,
      memoVisibility: userGeneralSetting?.memoVisibility,
    });
    await userServiceClient.updateUserSetting({
      setting: create(UserSettingSchema, {
        name: settingName,
        value: {
          case: "generalSetting",
          value: updatedGeneralSetting,
        },
      }),
      updateMask: create(FieldMaskSchema, { paths: ["general_setting.theme"] }),
    });
    await refetchSettings();
  };

  const handleSignOut = async () => {
    // First, clear auth state and cache BEFORE doing anything else
    await logout();

    try {
      // Then clear user-specific localStorage items
      // Preserve app-wide settings like theme
      const keysToPreserve = ["memos-theme", "tag-view-as-tree", "tag-tree-auto-expand", "viewStore"];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToPreserve.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // Ignore errors from localStorage operations
    }

    // Always redirect to auth page
    window.location.href = Routes.AUTH;
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
