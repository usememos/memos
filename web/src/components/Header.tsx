import classNames from "classnames";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useLayoutStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { resolution } from "@/utils/layout";
import Icon from "./Icon";
import UserBanner from "./UserBanner";

interface NavLinkItem {
  id: string;
  path: string;
  title: string;
  icon: React.ReactNode;
}

const Header = () => {
  const t = useTranslate();
  const location = useLocation();
  const layoutStore = useLayoutStore();
  const showHeader = layoutStore.state.showHeader;
  const user = useCurrentUser();

  useEffect(() => {
    const handleWindowResize = () => {
      if (window.innerWidth < resolution.sm) {
        layoutStore.setHeaderStatus(false);
      } else {
        layoutStore.setHeaderStatus(true);
      }
    };
    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();
  }, [location]);

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
  const authNavLink: NavLinkItem = {
    id: "header-auth",
    path: "/auth",
    title: t("common.sign-in"),
    icon: <Icon.LogIn className="mr-3 w-6 h-auto opacity-70" />,
  };

  const navLinks: NavLinkItem[] = user
    ? [homeNavLink, dailyReviewNavLink, resourcesNavLink, exploreNavLink, archivedNavLink, settingNavLink]
    : [exploreNavLink, authNavLink];

  return (
    <div
      className={`fixed sm:sticky top-0 left-0 w-full sm:w-56 h-full shrink-0 pointer-events-none sm:pointer-events-auto z-10 ${
        showHeader && "pointer-events-auto"
      }`}
    >
      <div
        className={`fixed top-0 left-0 w-full h-full bg-black opacity-0 pointer-events-none transition-opacity duration-300 sm:!hidden ${
          showHeader && "opacity-60 pointer-events-auto"
        }`}
        onClick={() => layoutStore.setHeaderStatus(false)}
      ></div>
      <header
        className={`relative w-56 sm:w-full h-full max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start py-4 z-30 bg-zinc-100 dark:bg-zinc-800 sm:bg-transparent sm:shadow-none transition-all duration-300 -translate-x-full sm:translate-x-0 ${
          showHeader && "translate-x-0 shadow-2xl"
        }`}
      >
        <UserBanner />
        <div className="w-full px-2 py-2 flex flex-col justify-start items-start shrink-0 space-y-2">
          {navLinks.map((navLink) => (
            <NavLink
              key={navLink.id}
              to={navLink.path}
              id={navLink.id}
              className={({ isActive }) =>
                classNames(
                  "px-4 pr-5 py-2 rounded-full border flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:border-gray-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700",
                  isActive ? "bg-white dark:bg-zinc-700 border-gray-200 dark:border-zinc-600" : "border-transparent"
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
    </div>
  );
};

export default Header;
