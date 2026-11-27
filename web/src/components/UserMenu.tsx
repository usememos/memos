import { Menu, menuClasses } from "@usememos/ui";
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
import { SCOPE_PANEL_ICON_CLASSES, SCOPE_PANEL_ROW_CLASSES, SCOPE_PANEL_STACK_CLASSES } from "@/components/AppSidebar/sidebar-layout";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUnreadInbox } from "@/hooks/useUnreadInbox";
import { useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
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
    {/* Like a nested submenu: its first row lines up with this one, and its rows match the panel's fixed menu density.
        When neither side has room (narrow screens), it drops below the row instead of overflowing. */}
    <Menu.Popup
      side="inline-end"
      align="start"
      collisionAvoidance={{ fallbackAxisSide: "end" }}
      positionMethod="fixed"
      className={className}
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
    <section aria-label={t("setting.preference.label")} className={SCOPE_PANEL_STACK_CLASSES}>
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
  label,
  onNavigate,
  trailing,
  children,
}: {
  to: string;
  icon: LucideIcon;
  current?: boolean;
  /** The accessible name when it says more than the visible text. */
  label?: string;
  onNavigate: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) => (
  <Link
    to={to}
    viewTransition
    aria-label={label}
    aria-current={current ? "page" : undefined}
    className={SCOPE_PANEL_ROW_CLASSES}
    onClick={onNavigate}
  >
    <ScopePanelRowIcon icon={icon} />
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
  </Link>
);

/**
 * The account menu behind the sidebar's footer row: the user's own pages, then preferences, then
 * About and Sign out. Guests get the preferences and About; they sign in from the footer row itself.
 */
const UserMenu = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslate();
  const location = useLocation();
  const { setMobileOpen } = useAppSidebar();
  const currentUser = useCurrentUser();
  const { logout } = useAuth();
  const unread = useUnreadInbox();
  const isAt = (path: string) => Boolean(matchPath(path, location.pathname));

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
      {currentUser && (
        <>
          <nav aria-label={t("setting.sso.account")} className={SCOPE_PANEL_STACK_CLASSES}>
            <NavRow
              to={Routes.INBOX}
              current={isAt(Routes.INBOX)}
              icon={BellIcon}
              label={unread.label}
              onNavigate={closePanel}
              trailing={unread.count > 0 && <span className="mu-caption tabular-nums text-mu-accent">{unread.text}</span>}
            >
              {t("common.inbox")}
            </NavRow>
            <NavRow to={Routes.ARCHIVED} current={isAt(Routes.ARCHIVED)} icon={ArchiveIcon} onNavigate={closePanel}>
              {t("common.archived")}
            </NavRow>
            <NavRow to={Routes.SETTING} current={isAt(Routes.SETTING)} icon={SettingsIcon} onNavigate={closePanel}>
              {t("common.settings")}
            </NavRow>
          </nav>
          <div role="separator" className={menuClasses().separator} />
        </>
      )}
      <UserPreferenceMenu />
      <div role="separator" className={menuClasses().separator} />
      <div className={SCOPE_PANEL_STACK_CLASSES}>
        <NavRow to={Routes.ABOUT} current={isAt(Routes.ABOUT)} icon={InfoIcon} onNavigate={closePanel}>
          {t("common.about")}
        </NavRow>
        {currentUser && (
          // Leaving is secondary to the pages above it, so it reads quieter.
          <button type="button" className={cn(SCOPE_PANEL_ROW_CLASSES, "text-mu-text-secondary")} onClick={() => void handleSignOut()}>
            <ScopePanelRowIcon icon={LogOutIcon} />
            <span className="min-w-0 flex-1 truncate">{t("common.sign-out")}</span>
          </button>
        )}
      </div>
    </>
  );
};

export default UserMenu;
