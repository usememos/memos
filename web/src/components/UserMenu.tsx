import { badgeClasses, Menu, menuClasses } from "@usememos/ui";
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
import { type ReactNode, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { ScopePanelRowIcon } from "@/components/AppSidebar/SidebarRow";
import { SCOPE_PANEL_ICON_CLASSES, SCOPE_PANEL_ROW_CLASSES, SIDEBAR_LEADING_SLOT_CLASSES } from "@/components/AppSidebar/sidebar-layout";
import UserAvatar from "@/components/UserAvatar";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import { useNotifications, useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserNotification_Status } from "@/types/proto/api/user_service_pb";
import { buildAuthRoute } from "@/utils/auth-redirect";
import { getLocaleDisplayName, getLocaleWithFallback, loadLocale, useTranslate } from "@/utils/i18n";
import { getThemeWithFallback, loadTheme, THEME_OPTIONS } from "@/utils/theme";

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
  <Menu.Root modal={false}>
    <Menu.Trigger openOnHover className={SCOPE_PANEL_ROW_CLASSES}>
      <ScopePanelRowIcon icon={Icon} />
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-end text-mu-text-secondary">
        {options.find((option) => option.value === value)?.label ?? value}
      </span>
      <ChevronRightIcon aria-hidden="true" className={cn(SCOPE_PANEL_ICON_CLASSES, "rtl:rotate-180")} />
    </Menu.Trigger>
    {/* Like a nested submenu: its first row lines up with this one, and its rows match the panel's (`mu-compact`).
        When neither side has room (narrow screens), it drops below the row instead of overflowing. */}
    <Menu.Popup
      side="inline-end"
      align="start"
      collisionAvoidance={{ fallbackAxisSide: "end" }}
      positionMethod="fixed"
      className={cn("mu-compact", className)}
    >
      <Menu.RadioGroup value={value} onValueChange={onChange}>
        {options.map((option) => (
          <Menu.RadioItem key={option.value} value={option.value} closeOnClick>
            {option.label}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    </Menu.Popup>
  </Menu.Root>
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
    <section aria-label={t("setting.preference.label")}>
      <PreferenceSubmenu
        icon={PaletteIcon}
        label={t("setting.preference.theme")}
        value={currentTheme}
        options={THEME_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
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

/** A page in the panel: a link on the menu row look, marked when it is the current page. */
const NavRow = ({
  to,
  icon,
  current,
  onNavigate,
  children,
}: {
  to: string;
  icon: LucideIcon;
  current?: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) => (
  <Link to={to} viewTransition aria-current={current ? "page" : undefined} className={SCOPE_PANEL_ROW_CLASSES} onClick={onNavigate}>
    <ScopePanelRowIcon icon={icon} />
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </Link>
);

/** The account half of the scope menu: preferences for everyone, then the user's own pages. */
const UserMenu = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslate();
  const location = useLocation();
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

  const closePanel = () => {
    onClose();
    setMobileOpen(false);
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
    window.location.replace(buildAuthRoute({ autoSignIn: false }));
  };

  return (
    <>
      <UserPreferenceMenu />
      <div role="separator" className={menuClasses().separator} />
      <section aria-label={t("setting.sso.account")}>
        {currentUser && (
          <>
            <div className="flex h-(--mu-row-height) items-center gap-2 px-(--mu-row-padding)">
              <span className={cn(SIDEBAR_LEADING_SLOT_CLASSES, "relative")}>
                <UserAvatar avatarUrl={currentUser.avatarUrl} name={accountLabel} className="size-5" />
                {sseStatus !== "connected" && (
                  <span
                    role="img"
                    aria-label={t(`live-update.${sseStatus}` as Parameters<typeof t>[0])}
                    className={cn(
                      "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-mu-surface",
                      sseStatus === "connecting" ? "animate-pulse bg-mu-text-secondary" : "bg-mu-danger-key",
                    )}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate mu-label">{accountLabel}</span>
              {/* A quiet chip beside the name: the package's badge look on a link. */}
              <Link
                to={Routes.INBOX}
                viewTransition
                aria-label={inboxLabel}
                aria-current={inboxActive ? "page" : undefined}
                className={cn(badgeClasses({ tone: "neutral" }), "border border-transparent mu-focus focus-visible:border-mu-focus")}
                onClick={closePanel}
              >
                <BellIcon aria-hidden="true" className="mu-icon-xs" />
                {t("common.inbox")}
                {unreadCount > 0 && <span className="tabular-nums text-mu-primary">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </Link>
            </div>
            <NavRow to={Routes.ARCHIVED} current={archivedActive} icon={ArchiveIcon} onNavigate={closePanel}>
              {t("common.archived")}
            </NavRow>
            <NavRow to={Routes.SETTING} icon={SettingsIcon} onNavigate={closePanel}>
              {t("common.settings")}
            </NavRow>
          </>
        )}
        <NavRow to={Routes.ABOUT} icon={InfoIcon} onNavigate={closePanel}>
          {t("common.about")}
        </NavRow>
        {/* Guests sign in from the sidebar footer, which is always in view. */}
        {currentUser && (
          // Leaving is secondary to the pages above it, so it reads quieter.
          <button type="button" className={cn(SCOPE_PANEL_ROW_CLASSES, "text-mu-text-secondary")} onClick={() => void handleSignOut()}>
            <ScopePanelRowIcon icon={LogOutIcon} />
            <span className="min-w-0 flex-1 truncate">{t("common.sign-out")}</span>
          </button>
        )}
      </section>
    </>
  );
};

export default UserMenu;
