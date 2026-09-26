import {
  ArchiveIcon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoIcon,
  LogOutIcon,
  PaletteIcon,
  SettingsIcon,
} from "lucide-react";
import { matchPath, useLocation } from "react-router-dom";
import { LocaleSearchList } from "@/components/LocalePicker";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useNotifications, useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { getLocaleDisplayName, getLocaleWithFallback, loadLocale, useTranslate } from "@/utils/i18n";
import { getThemeWithFallback, loadTheme, THEME_OPTIONS } from "@/utils/theme";

export type UserPreference = "theme" | "language";

const rowClass = "h-8 w-full justify-start gap-2 rounded-sm px-2 text-xs font-normal shadow-none hover:bg-accent";
const iconClass = "size-3.5 shrink-0 text-muted-foreground";

const UserMenu = ({ onClose, onSelectPreference }: { onClose: () => void; onSelectPreference: (preference: UserPreference) => void }) => {
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { setMobileOpen } = useAppSidebar();
  const currentUser = useCurrentUser();
  const sseStatus = useSSEConnectionStatus();
  const { userGeneralSetting, logout } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const currentLocale = getLocaleWithFallback(userGeneralSetting?.locale);
  const currentTheme = getThemeWithFallback(userGeneralSetting?.theme);
  const themeLabel = THEME_OPTIONS.find((option) => option.value === currentTheme)?.label ?? currentTheme;
  const unreadCount = notifications.filter((notification) => notification.status === UserNotification_Status.UNREAD).length;
  const inboxLabel = unreadCount > 0 ? `${t("common.inbox")}, ${unreadCount} ${t("inbox.unread")}` : t("common.inbox");
  const accountLabel = currentUser?.displayName || currentUser?.username || t("common.profile");
  const inboxActive = Boolean(matchPath(Routes.INBOX, location.pathname));
  const archivedActive = Boolean(matchPath(Routes.ARCHIVED, location.pathname));

  const navigateFromMenu = (path: string) => {
    onClose();
    setMobileOpen(false);
    navigateTo(path);
  };

  const handleSignOut = async () => {
    await logout();
    try {
      const keysToPreserve = ["memos-theme", "memos-locale", "memos-view-setting", "tag-view-as-tree"];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToPreserve.includes(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore errors from localStorage operations.
    }
    window.location.replace(Routes.AUTH);
  };

  return (
    <>
      <section aria-label={t("setting.preference.label")} className="border-t border-border/70 px-2 py-1">
        <Button variant="ghost" className={rowClass} onClick={() => onSelectPreference("theme")}>
          <PaletteIcon className={iconClass} />
          <span className="min-w-0 flex-1 text-start">{t("setting.preference.theme")}</span>
          <span className="max-w-28 truncate text-muted-foreground">{themeLabel}</span>
          <ChevronRightIcon className={iconClass} />
        </Button>
        <Button variant="ghost" className={rowClass} onClick={() => onSelectPreference("language")}>
          <GlobeIcon className={iconClass} />
          <span className="min-w-0 flex-1 text-start">{t("common.language")}</span>
          <span className="max-w-24 truncate text-muted-foreground">{getLocaleDisplayName(currentLocale)}</span>
          <ChevronRightIcon className={iconClass} />
        </Button>
      </section>
      <section aria-label={t("setting.sso.account")} className="border-t border-border/70 px-2 py-1">
        <div className="flex h-8 items-center gap-2 px-2">
          <span className="relative flex size-5 shrink-0 items-center justify-center">
            <UserAvatar avatarUrl={currentUser?.avatarUrl} name={accountLabel} className="size-5 rounded-[5px]" />
            {sseStatus !== "connected" && (
              <span
                role="img"
                aria-label={t(`live-update.${sseStatus}` as Parameters<typeof t>[0])}
                className={cn(
                  "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-popover",
                  sseStatus === "connecting" ? "animate-pulse bg-muted-foreground" : "bg-destructive",
                )}
              />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{accountLabel}</span>
          <Button
            variant="ghost"
            aria-label={inboxLabel}
            aria-current={inboxActive ? "page" : undefined}
            className={cn(
              "h-5 gap-1 rounded-sm bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
              inboxActive && "bg-accent text-foreground",
            )}
            onClick={() => navigateFromMenu(Routes.INBOX)}
          >
            <BellIcon className="size-3" />
            {t("common.inbox")}
            {unreadCount > 0 && <span className="tabular-nums text-primary">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </Button>
        </div>
        <Button
          variant="ghost"
          aria-current={archivedActive ? "page" : undefined}
          className={cn(rowClass, archivedActive && "bg-accent")}
          onClick={() => navigateFromMenu(Routes.ARCHIVED)}
        >
          <ArchiveIcon className={iconClass} />
          {t("common.archived")}
        </Button>
        <Button variant="ghost" className={rowClass} onClick={() => navigateFromMenu(Routes.SETTING)}>
          <SettingsIcon className={iconClass} />
          {t("common.settings")}
        </Button>
        <Button variant="ghost" className={rowClass} onClick={() => navigateFromMenu(Routes.ABOUT)}>
          <InfoIcon className={iconClass} />
          {t("common.about")}
        </Button>
        <Button variant="ghost" className={cn(rowClass, "text-muted-foreground")} onClick={() => void handleSignOut()}>
          <LogOutIcon className={iconClass} />
          {t("common.sign-out")}
        </Button>
      </section>
    </>
  );
};

export const UserPreferenceDialog = ({ preference, onClose }: { preference: UserPreference; onClose: () => void }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { userGeneralSetting, refetchSettings } = useAuth();
  const { mutate: updateUserGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);
  const currentLocale = getLocaleWithFallback(userGeneralSetting?.locale);
  const currentTheme = getThemeWithFallback(userGeneralSetting?.theme);

  const handleLocaleChange = (locale: Locale) => {
    if (!currentUser) return;
    loadLocale(locale);
    updateUserGeneralSetting({ generalSetting: { locale }, updateMask: ["locale"] }, { onSuccess: () => refetchSettings() });
    onClose();
  };

  const handleThemeChange = (theme: string) => {
    if (!currentUser) return;
    loadTheme(theme);
    updateUserGeneralSetting({ generalSetting: { theme }, updateMask: ["theme"] }, { onSuccess: () => refetchSettings() });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{preference === "theme" ? t("setting.preference.theme") : t("common.language")}</DialogTitle>
          <DialogDescription>
            {preference === "theme" ? t("setting.preference.theme-description") : t("setting.preference.language-description")}
          </DialogDescription>
        </DialogHeader>
        {preference === "theme" ? (
          <div className="rounded-md border p-1">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                aria-pressed={currentTheme === option.value}
                className={rowClass}
                onClick={() => handleThemeChange(option.value)}
              >
                <span className="min-w-0 flex-1 text-start">{option.label}</span>
                {currentTheme === option.value && <CheckIcon className="size-3.5 shrink-0" />}
              </Button>
            ))}
          </div>
        ) : (
          <LocaleSearchList value={currentLocale} onChange={handleLocaleChange} className="w-full max-w-none" />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserMenu;
