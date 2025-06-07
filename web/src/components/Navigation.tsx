import { Tooltip } from "@mui/joy";
import { EarthIcon, LibraryIcon, PaperclipIcon, UserCircleIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { userStore } from "@/store/v2";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import BrandBanner from "./BrandBanner";
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

const Navigation = observer((props: Props) => {
  const { collapsed, className } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    userStore.fetchInboxes();
  }, []);

  const homeNavLink: NavLinkItem = {
    id: "header-memos",
    path: Routes.ROOT,
    title: t("common.memos"),
    icon: <LibraryIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const exploreNavLink: NavLinkItem = {
    id: "header-explore",
    path: Routes.EXPLORE,
    title: t("common.explore"),
    icon: <EarthIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const resourcesNavLink: NavLinkItem = {
    id: "header-resources",
    path: Routes.RESOURCES,
    title: t("common.resources"),
    icon: <PaperclipIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };
  const signInNavLink: NavLinkItem = {
    id: "header-auth",
    path: Routes.AUTH,
    title: t("common.sign-in"),
    icon: <UserCircleIcon className="w-6 h-auto opacity-70 shrink-0" />,
  };

  const navLinks: NavLinkItem[] = currentUser ? [homeNavLink, exploreNavLink, resourcesNavLink] : [exploreNavLink, signInNavLink];

  return (
    <header
      className={cn(
        "w-full h-full overflow-auto flex flex-col justify-between items-start gap-4 py-4 md:pt-6 z-30 hide-scrollbar",
        className,
      )}
    >
      <div className="w-full px-1 py-1 flex flex-col justify-start items-start space-y-2 overflow-auto hide-scrollbar shrink">
        <NavLink className="mb-2 cursor-default" to={currentUser ? Routes.ROOT : Routes.EXPLORE}>
          <BrandBanner collapsed={collapsed} />
        </NavLink>
        {navLinks.map((navLink) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "px-2 py-2 rounded-2xl border flex flex-row items-center text-lg text-gray-800 dark:text-gray-400 hover:bg-white hover:border-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
                collapsed ? "" : "w-full px-4",
                isActive ? "bg-white drop-shadow-sm dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700" : "border-transparent",
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
      {currentUser && <UserBanner collapsed={collapsed} />}
    </header>
  );
});

export default Navigation;
