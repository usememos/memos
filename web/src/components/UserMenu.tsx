import {
  ArchiveIcon,
  BellIcon,
  CheckIcon,
  GlobeIcon,
  InfoIcon,
  LogOutIcon,
  MoreVerticalIcon,
  PaletteIcon,
  SettingsIcon,
  SquareUserIcon,
  User2Icon,
} from "lucide-react";
import { matchPath, useLocation } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useNotifications, useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { getLocaleWithFallback, loadLocale, useTranslate } from "@/utils/i18n";
import { getThemeWithFallback, loadTheme, THEME_OPTIONS } from "@/utils/theme";
import { SIDEBAR_LEADING_SLOT_CLASSES, sidebarSurfaceVariants } from "./AppSidebar/sidebar-layout";
import { LocaleSearchList } from "./LocalePicker";
import UserAvatar from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface Props {
  collapsed?: boolean;
}

const UserMenu = (props: Props) => {
  const { collapsed } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { setMobileOpen } = useAppSidebar();
  const currentUser = useCurrentUser();
  const { userGeneralSetting, refetchSettings, logout } = useAuth();
  const { mutate: updateUserGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);
  const { data: notifications = [] } = useNotifications();
  const sseStatus = useSSEConnectionStatus();
  const currentLocale = getLocaleWithFallback(userGeneralSetting?.locale);
  const currentTheme = getThemeWithFallback(userGeneralSetting?.theme);
  const inboxActive = Boolean(matchPath(Routes.INBOX, location.pathname));
  const archivedActive = Boolean(matchPath(Routes.ARCHIVED, location.pathname));
  const unreadCount = notifications.filter((notification) => notification.status === UserNotification_Status.UNREAD).length;
  const userLabel = currentUser?.displayName || currentUser?.username || t("common.profile");
  const triggerLabel = `${userLabel}, ${t("common.more")}${unreadCount > 0 ? `, ${unreadCount} ${t("inbox.unread")}` : ""}`;
  const inboxLabel = unreadCount > 0 ? `${t("common.inbox")}, ${unreadCount} ${t("inbox.unread")}` : t("common.inbox");

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
      const keysToPreserve = ["memos-theme", "memos-locale", "memos-view-setting", "tag-view-as-tree"];
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

  const navigateFromMenu = (path: string) => {
    setMobileOpen(false);
    navigateTo(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!currentUser}
        aria-label={triggerLabel}
        className={cn(
          sidebarSurfaceVariants({ role: "account" }),
          "cursor-pointer text-start text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 data-popup-open:bg-sidebar-accent",
          collapsed && "w-9",
        )}
      >
        <div className={cn(SIDEBAR_LEADING_SLOT_CLASSES, "relative")}>
          {currentUser?.avatarUrl ? (
            <UserAvatar className="size-5 rounded-[5px]" avatarUrl={currentUser?.avatarUrl} />
          ) : (
            <User2Icon className="me-auto size-4 text-muted-foreground" />
          )}
          {sseStatus !== "connected" && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-background",
                      sseStatus === "connecting" ? "bg-muted-foreground animate-pulse" : "bg-destructive",
                    )}
                  />
                }
              />
              <TooltipContent side="right">{t(`live-update.${sseStatus}` as Parameters<typeof t>[0])}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {!collapsed && (
          <span data-sidebar-label className="min-w-0 flex-1 truncate text-start text-[13px] font-medium text-foreground">
            {userLabel}
          </span>
        )}
        {!collapsed && (
          <span data-sidebar-trailing className="relative flex size-5 shrink-0 items-center justify-center">
            <MoreVerticalIcon className="size-4 text-muted-foreground/70" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                data-inbox-unread-indicator
                className="absolute end-0 top-0 size-1.5 rounded-full bg-primary ring-2 ring-sidebar"
              />
            )}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--anchor-width)]">
        <DropdownMenuItem onClick={() => navigateFromMenu(`/u/${encodeURIComponent(currentUser?.username ?? "")}`)}>
          <SquareUserIcon className="size-4 text-muted-foreground" />
          {t("common.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={inboxLabel}
          aria-current={inboxActive ? "page" : undefined}
          className={cn(inboxActive && "bg-accent text-accent-foreground")}
          onClick={() => navigateFromMenu(Routes.INBOX)}
        >
          <BellIcon className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">{t("common.inbox")}</span>
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="ms-auto min-w-5 rounded-full bg-primary/10 px-1.5 text-center text-[10px] font-medium text-primary"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-current={archivedActive ? "page" : undefined}
          className={cn(archivedActive && "bg-accent text-accent-foreground")}
          onClick={() => navigateFromMenu(Routes.ARCHIVED)}
        >
          <ArchiveIcon className="size-4 text-muted-foreground" />
          {t("common.archived")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GlobeIcon className="size-4 text-muted-foreground" />
            {t("common.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(24rem,var(--available-height))] overflow-y-auto p-0">
            <LocaleSearchList value={currentLocale} onChange={handleLocaleChange} className="w-64" />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon className="size-4 text-muted-foreground" />
            {t("setting.preference.theme")}
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
        <DropdownMenuItem onClick={() => navigateFromMenu(Routes.ABOUT)}>
          <InfoIcon className="size-4 text-muted-foreground" />
          {t("common.about")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigateFromMenu(Routes.SETTING)}>
          <SettingsIcon className="size-4 text-muted-foreground" />
          {t("common.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon className="size-4 text-muted-foreground" />
          {t("common.sign-out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
