import { BellIcon, EarthIcon, LibraryIcon, PaperclipIcon, UserCircleIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "./MemosLogo";
import UserMenu from "./UserMenu";

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
  const currentUser = useCurrentUser();
  const { data: notifications = [] } = useNotifications();

  const homeNavLink: NavLinkItem = {
    id: "header-memos",
    path: Routes.ROOT,
    title: t("common.memos"),
    icon: <LibraryIcon className="w-6 h-auto shrink-0" />,
  };
  const exploreNavLink: NavLinkItem = {
    id: "header-explore",
    path: Routes.EXPLORE,
    title: t("common.explore"),
    icon: <EarthIcon className="w-6 h-auto shrink-0" />,
  };
  const attachmentsNavLink: NavLinkItem = {
    id: "header-attachments",
    path: Routes.ATTACHMENTS,
    title: t("common.attachments"),
    icon: <PaperclipIcon className="w-6 h-auto shrink-0" />,
  };
  const unreadCount = notifications.filter((n) => n.status === UserNotification_Status.UNREAD).length;
  const inboxNavLink: NavLinkItem = {
    id: "header-inbox",
    path: Routes.INBOX,
    title: t("common.inbox"),
    icon: (
      <div className="relative">
        <BellIcon className="w-6 h-auto shrink-0" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-semibold rounded-full border-2 border-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    ),
  };
  const signInNavLink: NavLinkItem = {
    id: "header-auth",
    path: Routes.AUTH,
    title: t("common.sign-in"),
    icon: <UserCircleIcon className="w-6 h-auto shrink-0" />,
  };

  const navLinks: NavLinkItem[] = currentUser
    ? [homeNavLink, exploreNavLink, attachmentsNavLink, inboxNavLink]
    : [exploreNavLink, signInNavLink];

  return (
    <header className={cn("w-full h-full overflow-auto flex flex-col justify-between items-start gap-4 hide-scrollbar", className)}>
      <div className="w-full px-1 py-1 flex flex-col justify-start items-start space-y-2 overflow-auto overflow-x-hidden hide-scrollbar shrink">
        <NavLink className="mb-3 cursor-default" to={currentUser ? Routes.ROOT : Routes.EXPLORE}>
          <MemosLogo collapsed={collapsed} />
        </NavLink>
        {navLinks.map((navLink) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "px-2 py-2 rounded-2xl border flex flex-row items-center text-lg text-sidebar-foreground transition-colors",
                collapsed ? "" : "w-full px-4",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent-border drop-shadow"
                  : "border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent-border opacity-80",
              )
            }
            key={navLink.id}
            to={navLink.path}
            id={navLink.id}
            viewTransition
          >
            {props.collapsed ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>{navLink.icon}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{navLink.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              navLink.icon
            )}
            {!props.collapsed && <span className="ml-3 truncate">{navLink.title}</span>}
          </NavLink>
        ))}
      </div>
      {currentUser && (
        <div className={cn("w-full flex flex-col justify-end", props.collapsed ? "items-center" : "items-start pl-3")}>
          <UserMenu collapsed={collapsed} />
        </div>
      )}
    </header>
  );
};

export default Navigation;
