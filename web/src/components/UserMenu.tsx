import {
  ArchiveIcon,
  BellIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoIcon,
  LogOutIcon,
  type LucideIcon,
  PaletteIcon,
  SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useNotifications, useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { getLocaleDisplayName, getLocaleWithFallback, loadLocale, useTranslate } from "@/utils/i18n";
import { getThemeWithFallback, loadTheme, THEME_OPTIONS } from "@/utils/theme";

const rowClass = "h-8 w-full justify-start gap-2 rounded-sm px-2 text-xs font-normal shadow-none hover:bg-accent";
const iconClass = "size-3.5 shrink-0 text-muted-foreground";

interface PreferenceSubmenuProps {
  icon: LucideIcon;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Long lists scroll; typing jumps to a match. */
  className?: string;
}

/** A row that opens its choices beside the panel, like a submenu, and applies one on select. */
const PreferenceSubmenu = ({ icon: Icon, label, value, options, onChange, className }: PreferenceSubmenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger openOnHover render={<Button variant="ghost" className={cn(rowClass, "data-popup-open:bg-accent")} />}>
      <Icon className={iconClass} />
      <span className="min-w-0 flex-1 text-start">{label}</span>
      <span className="max-w-28 truncate text-muted-foreground">{options.find((option) => option.value === value)?.label ?? value}</span>
      <ChevronRightIcon className={cn(iconClass, "rtl:rotate-180")} />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="inline-end" align="start" sideOffset={8} alignOffset={-4} size="sm" className={className}>
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        {options.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const LOCALE_OPTIONS = locales.map((locale) => ({ value: locale, label: getLocaleDisplayName(locale) }));

/** Theme and language apply at once: saved to the account when signed in, otherwise kept in this browser. */
const UserPreferenceMenu = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { userGeneralSetting, refetchSettings } = useAuth();
  const { mutate: updateUserGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);
  // The chosen value shows immediately, before a signed-in save round-trips.
  const [theme, setTheme] = useState<string>();
  const [locale, setLocale] = useState<string>();
  const currentTheme = theme ?? getThemeWithFallback(userGeneralSetting?.theme);
  const currentLocale = locale ?? getLocaleWithFallback(userGeneralSetting?.locale);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    loadTheme(value);
    if (currentUser) {
      updateUserGeneralSetting({ generalSetting: { theme: value }, updateMask: ["theme"] }, { onSuccess: () => refetchSettings() });
    }
  };

  const handleLocaleChange = (value: string) => {
    setLocale(loadLocale(value));
    if (currentUser) {
      updateUserGeneralSetting({ generalSetting: { locale: value }, updateMask: ["locale"] }, { onSuccess: () => refetchSettings() });
    }
  };

  return (
    <section aria-label={t("setting.preference.label")} className="border-border/70 px-2 py-1 not-first:border-t">
      <PreferenceSubmenu
        icon={PaletteIcon}
        label={t("setting.preference.theme")}
        value={currentTheme}
        options={THEME_OPTIONS}
        onChange={handleThemeChange}
      />
      <PreferenceSubmenu
        icon={GlobeIcon}
        label={t("common.language")}
        value={currentLocale}
        options={LOCALE_OPTIONS}
        onChange={handleLocaleChange}
        className="max-h-72"
      />
    </section>
  );
};

/** The account half of the scope menu: preferences for everyone, then the user's own pages. */
const UserMenu = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { setMobileOpen } = useAppSidebar();
  const currentUser = useCurrentUser();
  const sseStatus = useSSEConnectionStatus();
  const { logout } = useAuth();
  const { data: notifications = [] } = useNotifications();
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
      <UserPreferenceMenu />
      <section aria-label={t("setting.sso.account")} className="border-t border-border/70 px-2 py-1">
        {currentUser && (
          <>
            <div className="flex h-8 items-center gap-2 px-2">
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                <UserAvatar avatarUrl={currentUser.avatarUrl} name={accountLabel} className="size-5 rounded-[5px]" />
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
          </>
        )}
        <Button variant="ghost" className={rowClass} onClick={() => navigateFromMenu(Routes.ABOUT)}>
          <InfoIcon className={iconClass} />
          {t("common.about")}
        </Button>
        {/* Guests sign in from the sidebar footer, which is always in view. */}
        {currentUser && (
          <Button variant="ghost" className={cn(rowClass, "text-muted-foreground")} onClick={() => void handleSignOut()}>
            <LogOutIcon className={iconClass} />
            {t("common.sign-out")}
          </Button>
        )}
      </section>
    </>
  );
};

export default UserMenu;
