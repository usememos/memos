import { useDirection } from "@base-ui/react/direction-provider";
import { useQueryClient } from "@tanstack/react-query";
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
  type LucideIcon,
  MapIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
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
import { memoViewServiceClient } from "@/connect";
import { type AttachmentSection, type InboxFilter, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemoViews, useNotifications, userKeys, useUser } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import {
  BUILTIN_TASKS_VIEW_ID,
  getMemoScopePath,
  getMemoViewId,
  isMemoScopeRoute,
  type MemoScope,
  resolveMemoScope,
} from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import type { MemoView } from "@/types/proto/api/v1/memo_view_service_pb";
import { User_Role, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import { getSidebarRouteKind } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_FOCUS_CLASSES, SIDEBAR_ROW_ICON_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, {
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_ACTION_ICON_CLASSES,
  SIDEBAR_SECTION_STACK_CLASSES,
} from "./SidebarSection";
import TagsSection from "./TagsSection";

const SIDEBAR_HORIZONTAL_PADDING = "px-3";

const ViewsSection = ({ manageActive = false }: { manageActive?: boolean }) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { memoView: selectedMemoView, setMemoView } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [deleteTarget, setDeleteTarget] = useState<MemoView>();
  const location = useLocation();

  const handleView = (viewId: string) => {
    setMemoView(selectedMemoView === viewId ? undefined : viewId);
    if (!isMemoScopeRoute(location.pathname)) navigate(ROUTES.HOME);
    setMobileOpen(false);
  };

  const handleCreate = () => {
    navigate(ROUTES.VIEWS, { state: { openCreate: true } });
    setMobileOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await memoViewServiceClient.deleteMemoView({ name: deleteTarget.name });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(currentUser?.name) });
      if (selectedMemoView === getMemoViewId(deleteTarget.name)) setMemoView(undefined);
      toast.success(t("setting.memo-view.delete-success", { title: deleteTarget.title }));
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Delete memo view" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <SidebarSection
      label={t("common.views")}
      action={
        !manageActive && (
          <div className="flex items-center gap-0.5">
            <MemoDisplaySettingMenu />
            <Button
              variant="ghost"
              size="icon-sm"
              className={SIDEBAR_SECTION_ACTION_BUTTON_CLASSES}
              onClick={handleCreate}
              aria-label={t("common.create")}
            >
              <PlusIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
            </Button>
          </div>
        )
      }
    >
      <SidebarRow
        active={!manageActive && selectedMemoView === BUILTIN_TASKS_VIEW_ID}
        label={t("common.tasks")}
        onClick={() => handleView(BUILTIN_TASKS_VIEW_ID)}
      />
      {memoViews.map((memoView) => {
        const id = getMemoViewId(memoView.name);
        const active = !manageActive && selectedMemoView === id;
        return (
          <div key={memoView.name} className={cn(SIDEBAR_ROW_CLASSES, "group/view", sidebarRowStateClasses(active))}>
            <button
              type="button"
              onClick={() => handleView(id)}
              aria-pressed={active || undefined}
              className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1 truncate">{memoView.title}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={false}
                render={
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("common.edit")} ${memoView.title}`}
                    className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-background/70 md:opacity-0 md:group-hover/view:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100"
                  />
                }
              >
                <MoreHorizontalIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={2} size="sm">
                <DropdownMenuItem
                  onClick={() => {
                    navigate(ROUTES.VIEWS, { state: { memoView } });
                    setMobileOpen(false);
                  }}
                >
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(memoView)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
      {manageActive && <SidebarRow active icon={MoreHorizontalIcon} label={t("common.manage")} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.memo-view.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
        confirmVariant="destructive"
      />
    </SidebarSection>
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
    <SidebarSection label={t("common.profile")}>
      <SidebarRow active={active === "memos"} icon={LayoutListIcon} label={t("common.memos")} onClick={() => setMode("memos")} />
      <SidebarRow active={active === "map"} icon={MapIcon} label={t("common.map")} onClick={() => setMode("map")} />
    </SidebarSection>
  );
};

const CollectionSidebarContent = ({ context }: { context: MemoStatsContext }) => {
  const t = useTranslate();
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
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      {context === "profile" && <ProfileMode />}
      <SidebarSection ariaLabel={t("common.statistics")}>
        <StatisticsView statisticsData={statistics} navigationTarget={filterTarget} onDateSelect={() => setMobileOpen(false)} />
      </SidebarSection>
      {showViews && <ViewsSection />}
      <TagsSection tagCount={tags} navigationTarget={filterTarget} scope={statsUserName ?? context} onSelect={() => setMobileOpen(false)} />
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
    <SidebarSection label={t("common.attachments")}>
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
    </SidebarSection>
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
    <SidebarSection label={t("common.inbox")}>
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
    </SidebarSection>
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
        className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(currentSection === section.key))}
      >
        <section.icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
        <span className="truncate">{t(section.labelKey)}</span>
      </Link>
    ));
  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection label={t("common.basic")}>{renderSections(basic)}</SidebarSection>
      {isHost && <SidebarSection label={t("common.admin")}>{renderSections(admin)}</SidebarSection>}
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
  if (kind === "views") return <ViewsSection manageActive />;
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
  alwaysExpanded?: boolean;
}

/**
 * Pills keep a constant px so the icon sits exactly where it does in the collapsed 30px
 * square; all width change comes from the label column, which animates 0fr -> 1fr. That
 * keeps the expand/collapse a single smooth motion with no padding jump.
 */
const navPillClasses = (active: boolean) =>
  cn(
    "relative flex h-[30px] min-w-0 items-center rounded-md px-[7px] transition-colors",
    SIDEBAR_ROW_FOCUS_CLASSES,
    sidebarRowStateClasses(active),
  );

const NavPillLabel = ({ expanded, label, children }: { expanded: boolean; label: ReactNode; children?: ReactNode }) => (
  <span
    aria-hidden={!expanded || undefined}
    className={cn(
      // The icon-label gap is padding on this element because overflow-hidden clips
      // content but never padding — it must animate to zero with the track, or collapsed
      // pills keep an 8px tail.
      "grid min-w-0 transition-[grid-template-columns,padding] duration-200 ease-out motion-reduce:transition-none",
      expanded ? "grid-cols-[1fr] pl-2" : "grid-cols-[0fr] pl-0",
    )}
  >
    {/* Content is shrink-0 so the collapsing track clips it in place — a plain
        left-to-right reveal instead of re-truncating the label on every frame. */}
    <span className="flex min-w-0 items-center gap-2 overflow-hidden">
      <span className="max-w-[5.5rem] shrink-0 truncate text-[12px]">{label}</span>
      {children}
    </span>
  </span>
);

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
          alwaysExpanded: true,
        },
        { id: "about", label: t("common.about"), path: ROUTES.ABOUT, icon: InfoIcon, active: location.pathname === ROUTES.ABOUT },
      ];

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
          <DropdownMenu
            onOpenChange={(open, eventDetails) => {
              // Off the scope routes the pill is a plain navigation button: veto the
              // menu and navigate to the scope instead.
              if (open && !scopeRouteActive) {
                eventDetails.cancel();
                navigateToScope(resolvedScope);
              }
            }}
          >
            <Tooltip disabled={scopeRouteActive}>
              {/* The tooltip anchors to a wrapper span rather than the button: a disabled
                  tooltip stamps data-trigger-disabled on its trigger element, and Base UI's
                  shared floating logic would read that as the MENU trigger being disabled. */}
              <TooltipTrigger render={<span className="flex min-w-0" />}>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={activeScopeItem.label}
                      aria-current={scopeRouteActive ? "page" : undefined}
                      className={cn("group/scope", navPillClasses(scopeRouteActive))}
                    />
                  }
                >
                  <ActiveScopeIcon className="size-4 shrink-0" strokeWidth={1.8} />
                  <NavPillLabel expanded={scopeRouteActive} label={activeScopeItem.label}>
                    <ChevronDownIcon
                      className="-mr-0.5 size-3 shrink-0 opacity-55 transition-transform duration-200 ease-out group-data-[popup-open]/scope:rotate-180 motion-reduce:transition-none"
                      strokeWidth={1.8}
                    />
                  </NavPillLabel>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">{activeScopeItem.label}</TooltipContent>
            </Tooltip>
            {scopeMenuContent}
          </DropdownMenu>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const expanded = item.active || !!item.alwaysExpanded;
          return (
            <Tooltip key={item.id} disabled={expanded}>
              <TooltipTrigger
                render={
                  <Link
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    aria-label={item.label}
                    aria-current={item.active ? "page" : undefined}
                    className={navPillClasses(item.active)}
                  />
                }
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                <NavPillLabel expanded={expanded} label={item.label} />
                {item.count != null && (
                  <span
                    className={cn(
                      "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none",
                      item.count > 0 ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  >
                    {item.count > 0 && (item.count > 99 ? "99+" : item.count)}
                  </span>
                )}
              </TooltipTrigger>
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
              className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
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
  const direction = useDirection();
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side={direction === "rtl" ? "right" : "left"}
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-border p-0 shadow-2xl [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
};

export default AppSidebar;
