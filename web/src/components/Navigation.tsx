import classNames from "classnames";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useInboxStore } from "@/store/v1";
import { Inbox_Status } from "@/types/proto/api/v2/inbox_service";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";
import UserBanner from "./UserBanner";

interface NavLinkItem {
  id: string;
  path: string;
  title: string;
  icon: React.ReactNode;
}

const Navigation = () => {
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
    const timer = setInterval(async () => {
      await inboxStore.fetchInboxes();
    }, 1000 * 60 * 5);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const homeNavLink: NavLinkItem = {
    id: "header-home",
    path: "/",
    title: t("common.home"),
    icon: <Icon.Home className="mr-3 w-6 h-auto opacity-70" />,
  };
  const dailyReviewNavLink: NavLinkItem = {
    id: "header-daily-review",
    path: "/review",
    title: t("daily-review.title"),
    icon: <Icon.Calendar className="mr-3 w-6 h-auto opacity-70" />,
  };
  const resourcesNavLink: NavLinkItem = {
    id: "header-resources",
    path: "/resources",
    title: t("common.resources"),
    icon: <Icon.Paperclip className="mr-3 w-6 h-auto opacity-70" />,
  };
  const inboxNavLink: NavLinkItem = {
    id: "header-inbox",
    path: "/inbox",
    title: t("common.inbox"),
    icon: (
      <>
        <div className="relative">
          <Icon.Bell className="mr-3 w-6 h-auto opacity-70" />
          {hasUnreadInbox && <div className="absolute top-0 left-5 w-2 h-2 rounded-full bg-blue-500"></div>}
        </div>
      </>
    ),
  };
  const exploreNavLink: NavLinkItem = {
    id: "header-explore",
    path: "/explore",
    title: t("common.explore"),
    icon: <Icon.Hash className="mr-3 w-6 h-auto opacity-70" />,
  };
  const archivedNavLink: NavLinkItem = {
    id: "header-archived",
    path: "/archived",
    title: t("common.archived"),
    icon: <Icon.Archive className="mr-3 w-6 h-auto opacity-70" />,
  };
  const settingNavLink: NavLinkItem = {
    id: "header-setting",
    path: "/setting",
    title: t("common.settings"),
    icon: <Icon.Settings className="mr-3 w-6 h-auto opacity-70" />,
  };
  const signInNavLink: NavLinkItem = {
    id: "header-auth",
    path: "/auth",
    title: t("common.sign-in"),
    icon: <Icon.LogIn className="mr-3 w-6 h-auto opacity-70" />,
  };

  const navLinks: NavLinkItem[] = user
    ? [homeNavLink, dailyReviewNavLink, resourcesNavLink, exploreNavLink, inboxNavLink, archivedNavLink, settingNavLink]
    : [exploreNavLink, signInNavLink];

  return (
    <header className="w-full h-full overflow-auto flex flex-col justify-start items-start py-4 z-30">
      <UserBanner />
      <div className="w-full px-2 py-2 flex flex-col justify-start items-start shrink-0 space-y-2">
        {navLinks.map((navLink) => (
          <NavLink
            key={navLink.id}
            to={navLink.path}
            id={navLink.id}
            className={({ isActive }) =>
              classNames(
                "px-4 pr-5 py-2 rounded-2xl border flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:border-gray-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700",
                isActive ? "bg-white drop-shadow-sm dark:bg-zinc-700 border-gray-200 dark:border-zinc-600" : "border-transparent"
              )
            }
          >
            <>
              {navLink.icon} {navLink.title}
            </>
          </NavLink>
        ))}
      </div>
    </header>
  );
};

export default Navigation;
