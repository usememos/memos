import {
  ArchiveIcon,
  ArrowRightIcon,
  BellIcon,
  ChevronDownIcon,
  EarthIcon,
  FileAudioIcon,
  FileTextIcon,
  HouseIcon,
  ImageIcon,
  InfoIcon,
  LayoutListIcon,
  ListIcon,
  ListTodoIcon,
  type LucideIcon,
  MapIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MemoDetailSidebar } from "@/components/MemoDetailSidebar";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import { SETTINGS_SECTIONS } from "@/components/Settings/settingSections";
import StatisticsView from "@/components/StatisticsView";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { shortcutServiceClient } from "@/connect";
import { type AttachmentSection, type InboxFilter, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useNotifications, useUser } from "@/hooks/useUserQueries";
import {
  BUILTIN_TASKS_VIEW_ID,
  getMemoScopePath,
  getShortcutId,
  isMemoScopeRoute,
  type MemoScope,
  resolveMemoScope,
} from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Shortcut } from "@/types/proto/api/v1/shortcut_service_pb";
import { User_Role, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import { getSidebarRouteKind } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_ICON_CLASSES } from "./SidebarRow";
import SidebarSectionHeader from "./SidebarSectionHeader";
import TagsSection from "./TagsSection";

const SIDEBAR_HORIZONTAL_PADDING = "px-3";

const ViewsSection = ({ manageActive = false }: { manageActive?: boolean }) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { shortcuts, refetchSettings } = useAuth();
  const { shortcut: selectedShortcut, setShortcut } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [deleteTarget, setDeleteTarget] = useState<Shortcut>();
  const location = useLocation();

  const handleView = (viewId: string) => {
    setShortcut(selectedShortcut === viewId ? undefined : viewId);
    if (!isMemoScopeRoute(location.pathname)) navigate(ROUTES.HOME);
    setMobileOpen(false);
  };

  const handleCreate = () => {
    navigate(ROUTES.SHORTCUTS, { state: { openCreate: true } });
    setMobileOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await shortcutServiceClient.deleteShortcut({ name: deleteTarget.name });
    await refetchSettings();
    if (selectedShortcut === getShortcutId(deleteTarget.name)) setShortcut(undefined);
    toast.success(t("setting.shortcut.delete-success", { title: deleteTarget.title }));
    setDeleteTarget(undefined);
  };

  return (
    <section>
      <SidebarSectionHeader
        action={
          !manageActive && (
            <div className="flex items-center gap-0.5">
              <MemoDisplaySettingMenu />
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-5 rounded text-muted-foreground"
                onClick={handleCreate}
                aria-label={t("common.create")}
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </div>
          )
        }
      >
        {t("common.views")}
      </SidebarSectionHeader>
      <div className="space-y-0.5">
        <SidebarRow
          active={!manageActive && selectedShortcut === BUILTIN_TASKS_VIEW_ID}
          icon={ListTodoIcon}
          label={t("common.tasks")}
          onClick={() => handleView(BUILTIN_TASKS_VIEW_ID)}
        />
        {shortcuts.map((shortcut) => {
          const id = getShortcutId(shortcut.name);
          const active = !manageActive && selectedShortcut === id;
          return (
            <div
              key={shortcut.name}
              className={cn(
                SIDEBAR_ROW_CLASSES,
                "group/view",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => handleView(id)}
                aria-pressed={active || undefined}
                className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <SparklesIcon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate">{shortcut.title}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton={false}
                  render={
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`${t("common.edit")} ${shortcut.title}`}
                      className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-background/70 md:opacity-0 md:group-hover/view:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100"
                    />
                  }
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      navigate(ROUTES.SHORTCUTS, { state: { shortcut } });
                      setMobileOpen(false);
                    }}
                  >
                    {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(shortcut)}>
                    <Trash2Icon className="size-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {manageActive && <SidebarRow active icon={MoreHorizontalIcon} label={t("common.shortcuts")} />}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.shortcut.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
        confirmVariant="destructive"
      />
    </section>
  );
};

const ProfileMode = () => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setMobileOpen } = useAppSidebar();
  const active = searchParams.get("view") === "map" ? "map" : "memos";
  const setMode = (mode: "memos" | "map") => {
    setSearchParams((params) => {
      mode === "map" ? params.set("view", "map") : params.delete("view");
      return params;
    });
    setMobileOpen(false);
  };

  return (
    <div className="space-y-0.5">
      <SidebarRow active={active === "memos"} icon={LayoutListIcon} label={t("common.memos")} onClick={() => setMode("memos")} />
      <SidebarRow active={active === "map"} icon={MapIcon} label={t("common.map")} onClick={() => setMode("map")} />
    </div>
  );
};

const CollectionSidebarContent = ({ context }: { context: MemoStatsContext }) => {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const md = useMediaQuery("md");
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const profileMatch = matchPath("/u/:username", location.pathname);
  const { data: profileUser } = useUser(profileMatch?.params.username ? `users/${profileMatch.params.username}` : "", {
    enabled: context === "profile" && !!profileMatch?.params.username,
  });
  const statsUserName = context === "home" ? currentUser?.name : context === "profile" ? profileUser?.name : undefined;
  const { statistics, tags } = useFilteredMemoStats({
    context,
    userName: statsUserName,
    enabled: authInitialized && instanceInitialized && (md || mobileOpen),
  });

  const showViews = !!currentUser && (context === "home" || context === "archived" || context === "explore");

  // Off the collection routes (the library shown as fallback content), calendar and tag
  // clicks must land somewhere that renders the filtered feed.
  const onCollectionRoute = isMemoScopeRoute(location.pathname) || !!profileMatch;
  const filterTarget = onCollectionRoute ? undefined : context === "explore" ? ROUTES.EXPLORE : ROUTES.HOME;

  return (
    <div className="space-y-3.5">
      {context === "profile" && <ProfileMode />}
      <section>
        <StatisticsView statisticsData={statistics} navigationTarget={filterTarget} onDateSelect={() => setMobileOpen(false)} />
      </section>
      {showViews && <ViewsSection />}
      <TagsSection tagCount={tags} navigationTarget={filterTarget} onSelect={() => setMobileOpen(false)} />
    </div>
  );
};

const AttachmentsSidebarContent = () => {
  const t = useTranslate();
  const { attachmentSection, setAttachmentSection, setMobileOpen } = useAppSidebar();
  const { isComplete, stats } = useAttachmentLibraryStats();
  const total = stats.media + stats.documents + stats.audio;
  const rows: Array<{ value: AttachmentSection; icon: LucideIcon; label: string; count?: number }> = [
    { value: "all", icon: ListIcon, label: t("common.all"), count: isComplete ? total : undefined },
    { value: "media", icon: ImageIcon, label: t("attachment-library.tabs.media"), count: isComplete ? stats.media : undefined },
    { value: "audio", icon: FileAudioIcon, label: t("attachment-library.tabs.audio"), count: isComplete ? stats.audio : undefined },
    {
      value: "documents",
      icon: FileTextIcon,
      label: t("attachment-library.tabs.documents"),
      count: isComplete ? stats.documents : undefined,
    },
    { value: "unused", icon: Trash2Icon, label: t("attachment-library.labels.unused"), count: isComplete ? stats.unused : undefined },
  ];
  return (
    <div className="space-y-0.5">
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          active={attachmentSection === row.value}
          icon={row.icon}
          label={row.label}
          count={row.count}
          onClick={() => {
            setAttachmentSection(row.value);
            setMobileOpen(false);
          }}
        />
      ))}
    </div>
  );
};

const InboxSidebarContent = () => {
  const t = useTranslate();
  const { inboxFilter, setInboxFilter, setMobileOpen } = useAppSidebar();
  const { data: notifications = [] } = useNotifications();
  const rows: Array<{ value: InboxFilter; icon: LucideIcon; label: string; count: number }> = [
    { value: "all", icon: ListIcon, label: t("common.all"), count: notifications.length },
    {
      value: "unread",
      icon: BellIcon,
      label: t("inbox.unread"),
      count: notifications.filter((item) => item.status === UserNotification_Status.UNREAD).length,
    },
    {
      value: "archived",
      icon: ArchiveIcon,
      label: t("common.archived"),
      count: notifications.filter((item) => item.status === UserNotification_Status.ARCHIVED).length,
    },
  ];
  return (
    <div className="space-y-0.5">
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          active={inboxFilter === row.value}
          icon={row.icon}
          label={row.label}
          count={row.count}
          onClick={() => {
            setInboxFilter(row.value);
            setMobileOpen(false);
          }}
        />
      ))}
    </div>
  );
};

const SettingsSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const user = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const isHost = user?.role === User_Role.ADMIN;
  const currentSection = location.hash.slice(1) || "my-account";
  const basic = SETTINGS_SECTIONS.filter((section) => section.scope === "basic");
  const admin = SETTINGS_SECTIONS.filter((section) => section.scope === "admin");
  const renderSections = (sections: typeof SETTINGS_SECTIONS) =>
    sections.map((section) => (
      <Link
        key={section.key}
        to={`${ROUTES.SETTING}#${section.key}`}
        onClick={() => setMobileOpen(false)}
        className={cn(
          SIDEBAR_ROW_CLASSES,
          currentSection === section.key
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
        )}
      >
        <section.icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
        <span className="truncate">{t(section.labelKey)}</span>
      </Link>
    ));
  return (
    <div className="space-y-3.5">
      <section>
        <SidebarSectionHeader>{t("common.basic")}</SidebarSectionHeader>
        <div className="space-y-0.5">{renderSections(basic)}</div>
      </section>
      {isHost && (
        <section>
          <SidebarSectionHeader>{t("common.admin")}</SidebarSectionHeader>
          <div className="space-y-0.5">{renderSections(admin)}</div>
        </section>
      )}
    </div>
  );
};

const MemoDetailSidebarContent = () => {
  const { memoDetail } = useAppSidebar();
  if (!memoDetail) return null;
  return (
    <MemoDetailSidebar
      memo={memoDetail.memo}
      forceReadonly={memoDetail.readonly}
      onShareImageOpen={memoDetail.onShareImageOpen}
      className="pb-2"
    />
  );
};

const RouteSidebarContent = () => {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { memoDetail } = useAppSidebar();
  const kind = getSidebarRouteKind(location.pathname);
  if (kind === "home" || kind === "archived" || kind === "explore" || kind === "profile") {
    return <CollectionSidebarContent context={kind} />;
  }
  if (kind === "shortcuts") return <ViewsSection manageActive />;
  if (kind === "attachments") return <AttachmentsSidebarContent />;
  if (kind === "inbox") return <InboxSidebarContent />;
  if (kind === "settings") return <SettingsSidebarContent />;
  if (kind === "memo" && memoDetail) return <MemoDetailSidebarContent />;
  // Routes without a specific tenant (about, error pages, unknown paths, memo detail
  // before the page publishes its descriptor) fall back to the default library content.
  return <CollectionSidebarContent context={currentUser ? "home" : "explore"} />;
};

interface GlobalNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
}

const GlobalNavigation = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { data: notifications = [] } = useNotifications();
  const { memoDetail, memoScope, setMemoScope, setMobileOpen } = useAppSidebar();
  const { filters } = useMemoFilterContext();
  const unreadCount = notifications.filter((notification) => notification.status === UserNotification_Status.UNREAD).length;
  const routeKind = getSidebarRouteKind(location.pathname);
  const resolvedScope = resolveMemoScope(location.pathname, {
    currentUsername: currentUser?.username,
    detailFrom: memoDetail?.from,
    memoArchived: memoDetail?.memo.state === State.ARCHIVED,
    fallback: memoScope,
  });
  const routeOwnsScope = isMemoScopeRoute(location.pathname) || routeKind === "profile" || routeKind === "memo";
  const scopeRouteActive = isMemoScopeRoute(location.pathname);

  useEffect(() => {
    if (routeOwnsScope && resolvedScope !== memoScope) {
      setMemoScope(resolvedScope);
    }
  }, [memoScope, resolvedScope, routeOwnsScope, setMemoScope]);

  const scopeItems: Array<{ id: MemoScope; label: string; icon: LucideIcon }> = [
    { id: "home", label: t("common.home"), icon: HouseIcon },
    { id: "explore", label: t("common.explore"), icon: EarthIcon },
    { id: "archived", label: t("common.archived"), icon: ArchiveIcon },
  ];
  const activeScopeItem = scopeItems.find((item) => item.id === resolvedScope) ?? scopeItems[0];
  const ActiveScopeIcon = activeScopeItem.icon;

  const navigateToScope = (scope: MemoScope) => {
    const filterQuery = stringifyFilters(filters);
    setMemoScope(scope);
    navigate({ pathname: getMemoScopePath(scope), search: filterQuery ? `?filter=${filterQuery}` : "" });
    setMobileOpen(false);
  };

  const items: GlobalNavItem[] = currentUser
    ? [
        {
          id: "attachments",
          label: t("common.attachments"),
          path: ROUTES.ATTACHMENTS,
          icon: PaperclipIcon,
          active: location.pathname === ROUTES.ATTACHMENTS,
        },
        {
          id: "inbox",
          label: t("common.inbox"),
          path: ROUTES.INBOX,
          icon: BellIcon,
          active: location.pathname === ROUTES.INBOX,
          count: unreadCount,
        },
      ]
    : [
        {
          id: "explore",
          label: t("common.explore"),
          path: ROUTES.EXPLORE,
          icon: EarthIcon,
          active: routeKind === "explore" || routeKind === "profile" || routeKind === "memo",
        },
        { id: "about", label: t("common.about"), path: ROUTES.ABOUT, icon: InfoIcon, active: location.pathname === ROUTES.ABOUT },
      ];

  const scopeTrigger = (
    <DropdownMenuTrigger
      render={
        <button
          type="button"
          aria-label={activeScopeItem.label}
          aria-current="page"
          className="flex h-[30px] min-w-0 items-center gap-2 rounded-md bg-sidebar-accent px-2 font-medium text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      }
    >
      <ActiveScopeIcon className="size-4 shrink-0" strokeWidth={1.8} />
      <span className="max-w-[5.5rem] truncate text-[12px]">{activeScopeItem.label}</span>
      <ChevronDownIcon className="size-3 shrink-0 opacity-55" strokeWidth={1.8} />
    </DropdownMenuTrigger>
  );

  const scopeMenuContent = (
    <DropdownMenuContent align="start" sideOffset={4} className="flex w-36 flex-col gap-0.5">
      {scopeItems.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownMenuItem
            key={item.id}
            aria-current={item.id === resolvedScope ? "page" : undefined}
            className={cn(
              "h-[30px] shrink-0 py-0 text-[13px]",
              item.id === resolvedScope && "bg-accent font-medium text-accent-foreground",
            )}
            onClick={() => navigateToScope(item.id)}
          >
            <Icon className="size-4" strokeWidth={1.8} />
            <span className="truncate">{item.label}</span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  );

  return (
    <TooltipProvider>
      <nav className={cn("flex h-9 items-center gap-1", SIDEBAR_HORIZONTAL_PADDING)} aria-label="Primary">
        {currentUser && (
          <>
            {scopeRouteActive ? (
              <DropdownMenu>
                {scopeTrigger}
                {scopeMenuContent}
              </DropdownMenu>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={activeScopeItem.label}
                      className="flex size-[30px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => navigateToScope(resolvedScope)}
                    />
                  }
                >
                  <ActiveScopeIcon className="size-4" strokeWidth={1.8} />
                </TooltipTrigger>
                <TooltipContent side="bottom">{activeScopeItem.label}</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const alwaysShowLabel = !currentUser && item.id === "explore";
          const itemClassName = cn(
            "relative flex min-w-0 items-center justify-center gap-2 rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            item.active || alwaysShowLabel ? "h-[30px] px-2" : "size-[30px] px-0",
            item.active
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/65 hover:text-foreground",
          );
          const itemContent = (
            <>
              <Icon className="size-4 shrink-0" strokeWidth={1.8} />
              {(item.active || alwaysShowLabel) && <span className="max-w-[5.5rem] truncate text-[12px]">{item.label}</span>}
              {!!item.count && item.count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              )}
            </>
          );
          const content = (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              className={itemClassName}
            >
              {itemContent}
            </Link>
          );
          if (item.active) return content;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger render={<span />}>{content}</TooltipTrigger>
              <TooltipContent side="bottom">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
};

const AppSidebar = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { setMobileOpen, setQuickFindOpen } = useAppSidebar();
  return (
    <aside className={cn("flex h-full w-full select-none flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className={cn("flex h-13 shrink-0 items-center justify-between gap-2", SIDEBAR_HORIZONTAL_PADDING)}>
        <Link
          to={currentUser ? ROUTES.HOME : ROUTES.EXPLORE}
          className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <MemosLogo compact />
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => {
            setMobileOpen(false);
            setQuickFindOpen(true);
          }}
          aria-label={t("common.search")}
        >
          <SearchIcon className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
      <GlobalNavigation />
      <div className="mx-3 mt-2 border-t border-border/70" />
      <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-3 [scrollbar-width:thin]", SIDEBAR_HORIZONTAL_PADDING)}>
        <RouteSidebarContent />
      </div>
      <footer className="shrink-0 border-t border-border/70">
        {currentUser ? (
          <UserMenu />
        ) : (
          <Link
            to={ROUTES.AUTH}
            onClick={() => setMobileOpen(false)}
            className="group flex h-10 w-full min-w-0 items-center justify-between gap-2 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <UserRoundIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <span className="truncate">{t("common.sign-in-to-memos")}</span>
            </span>
            <ArrowRightIcon
              className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.8}
            />
          </Link>
        )}
      </footer>
    </aside>
  );
};

export const MobileAppHeader = () => {
  const currentUser = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 w-full items-center justify-start gap-1 border-b border-border/70 bg-background/90 px-2 backdrop-blur-md md:hidden">
      <Button variant="ghost" size="icon-sm" className="size-8" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <MenuIcon className="size-[18px]" />
      </Button>
      <Link
        to={currentUser ? ROUTES.HOME : ROUTES.EXPLORE}
        className="min-w-0 max-w-[12rem] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MemosLogo compact />
      </Link>
    </header>
  );
};

export const MobileAppSidebar = () => {
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-border p-0 shadow-2xl [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
};

export default AppSidebar;
