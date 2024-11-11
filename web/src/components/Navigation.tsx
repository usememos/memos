import { Tooltip } from "@mui/joy";
import clsx from "clsx";
import { ArchiveIcon, BellIcon, Globe2Icon, HomeIcon, LogInIcon, PaperclipIcon, SettingsIcon, SmileIcon, User2Icon } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { useInboxStore } from "@/store/v1";
import { Inbox_Status } from "@/types/proto/api/v1/inbox_service";
import { useTranslate } from "@/utils/i18n";
import UserBanner from "./UserBanner";

interface NavLinkItem {
  id: string;
  path: string;
  title: string;
  icon: React.ReactNode;
}

interface Props {
  collapsed?: boolean;
  className?: string;
}

const Navigation = (props: Props) => {
  const { collapsed, className } = props;
  const t = useTranslate();
  const user = useCurrentUser();
  const inboxStore = useInboxStore();
  const hasUnreadInbox = inboxStore.inboxes.some((inbox) => inbox.status === Inbox_Status.UNREAD);

  useEffect(() => {
    if (!user) {
      return;
    }

    inboxStore.fetchInboxes();
    // Fetch inboxes every 5 minutes.
    const timer = setInterval(
      async () => {
        await inboxStore.fetchInboxes();
      },
      1000 * 60 * 5,
    );

    return () => {
      clearInterval(timer);
    };
  }, []);

  const homeNavLink: NavLinkItem = {
    id: "header-home",
    path: Routes.ROOT,
    title: t("common.home"),
    icon: <HomeIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const resourcesNavLink: NavLinkItem = {
    id: "header-resources",
    path: Routes.RESOURCES,
    title: t("common.resources"),
    icon: <PaperclipIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const exploreNavLink: NavLinkItem = {
    id: "header-explore",
    path: Routes.EXPLORE,
    title: t("common.explore"),
    icon: <Globe2Icon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const profileNavLink: NavLinkItem = {
    id: "header-profile",
    path: user ? `/u/${encodeURIComponent(user.username)}` : "",
    title: t("common.profile"),
    icon: <User2Icon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const inboxNavLink: NavLinkItem = {
    id: "header-inbox",
    path: Routes.INBOX,
    title: t("common.inbox"),
    icon: (
      <>
        <div className="relative">
          <BellIcon className="w-6 h-auto opacity-70 shrink-0" />
          {hasUnreadInbox && <div className="absolute top-0 left-5 w-2 h-2 rounded-full bg-blue-500"></div>}
        </div>
      </>
    ),
  };
  const archivedNavLink: NavLinkItem = {
    id: "header-archived",
    path: Routes.ARCHIVED,
    title: t("common.archived"),
    icon: <ArchiveIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const settingNavLink: NavLinkItem = {
    id: "header-setting",
    path: Routes.SETTING,
    title: t("common.settings"),
    icon: <SettingsIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const signInNavLink: NavLinkItem = {
    id: "header-auth",
    path: Routes.AUTH,
    title: t("common.sign-in"),
    icon: <LogInIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const aboutNavLink: NavLinkItem = {
    id: "header-about",
    path: Routes.ABOUT,
    title: t("common.about"),
    icon: <SmileIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };

  const navLinks: NavLinkItem[] = user
    ? [homeNavLink, resourcesNavLink, exploreNavLink, profileNavLink, inboxNavLink, archivedNavLink, settingNavLink]
    : [exploreNavLink, signInNavLink, aboutNavLink];

  return (
    <header
      className={clsx("w-full h-full overflow-auto flex flex-col justify-start items-start py-4 md:pt-6 z-30 hide-scrollbar", className)}
    >
      <UserBanner collapsed={collapsed} />
      <div className="w-full px-1 py-2 flex flex-col justify-start items-start shrink-0 space-y-2">
        {navLinks.map((navLink) => (
          <NavLink
            className={({ isActive }) =>
              clsx(
                "px-2 py-2 rounded-2xl border flex flex-row items-center text-lg text-gray-800 dark:text-gray-400 hover:bg-white hover:border-gray-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
                collapsed ? "" : "w-full px-4",
                isActive ? "bg-white drop-shadow-sm dark:bg-zinc-800 border-gray-200 dark:border-zinc-700" : "border-transparent",
              )
            }
            key={navLink.id}
            to={navLink.path}
            id={navLink.id}
            viewTransition
          >
            {props.collapsed ? (
              <Tooltip title={navLink.title} placement="right" arrow>
                <div>{navLink.icon}</div>
              </Tooltip>
            ) : (
              navLink.icon
            )}
            {!props.collapsed && <span className="ml-3 truncate">{navLink.title}</span>}
          </NavLink>
        ))}
      </div>
    </header>
  );
};

export default Navigation;
