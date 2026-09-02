import { useDirection } from "@base-ui/react/direction-provider";
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
  PaperclipIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link, matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MemoDetailSidebar } from "@/components/MemoDetailSidebar";
import { DEFAULT_SETTING_SECTION, SETTINGS_SECTIONS } from "@/components/Settings/settingSections";
import StatisticsView from "@/components/StatisticsView";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AttachmentSection, type InboxFilter, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useInstance } from "@/contexts/InstanceContext";
import { stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useNotifications, useUser } from "@/hooks/useUserQueries";
import { getMemoScopePath, isMemoScopeRoute, type PrimaryMemoScope, resolveMemoScope } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { User_Role, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import CommonSidebarContent from "./CommonSidebarContent";
import { getSidebarRouteKind, routeSupportsCollectionScope } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_FOCUS_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "./SidebarSection";
import SpaceSwitcher from "./SpaceSwitcher";
import {
  SIDEBAR_LEADING_SLOT_CLASSES,
  SIDEBAR_NAV_LEADING_SLOT_CLASSES,
  SIDEBAR_RAIL_CLASSES,
  sidebarSurfaceVariants,
} from "./sidebar-layout";
import TagsSection from "./TagsSection";
import ViewsSection from "./ViewsSection";

const SIDEBAR_HEADER_ACTION_CLASSES =
  "size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";
const SIDEBAR_HEADER_PRIMARY_ACTION_CLASSES =
  "size-7 shrink-0 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";

const NewMemoAction = ({ onClick }: { onClick: () => void }) => {
  const t = useTranslate();
  const label = t("editor.new-memo");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className={SIDEBAR_HEADER_PRIMARY_ACTION_CLASSES}
            onClick={onClick}
            aria-label={label}
            data-new-memo-trigger
          />
        }
      >
        <SquarePenIcon className="size-4" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
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
      <SidebarRow
        state={active === "memos" ? "current" : "idle"}
        icon={LayoutListIcon}
        label={t("common.memos")}
        onClick={() => setMode("memos")}
      />
      <SidebarRow state={active === "map" ? "current" : "idle"} icon={MapIcon} label={t("common.map")} onClick={() => setMode("map")} />
    </SidebarSection>
  );
};

const CollectionSidebarContent = ({ context }: { context: MemoStatsContext }) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const md = useMediaQuery("md");
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const profileMatch = matchPath("/u/:username", location.pathname);
  const { data: profileUser } = useUser(profileMatch?.params.username ? `users/${profileMatch.params.username}` : "", {
    enabled: context === "profile" && !!profileMatch?.params.username,
  });
  const statsUserName = context === "home" ? currentUser?.name : context === "profile" ? profileUser?.name : undefined;
  // User-level collections stay aligned with their unscoped feeds even when a Space is remembered.
  const isUserLevelCollection = context === "profile" || context === "archived";
  const statsFilter = isUserLevelCollection ? undefined : memoFilter;
  const { statistics, tags } = useFilteredMemoStats({
    context,
    userName: statsUserName,
    filter: statsFilter,
    enabled: authInitialized && instanceInitialized && (md || mobileOpen),
  });

  const showViews = !!currentUser && (context === "home" || context === "archived" || context === "explore");

  // Off the collection routes (the library shown as fallback content), calendar and tag
  // clicks must land somewhere that renders the filtered feed.
  const onCollectionRoute = isMemoScopeRoute(location.pathname) || !!profileMatch;
  const filterTarget = onCollectionRoute ? undefined : context === "explore" ? ROUTES.EXPLORE : ROUTES.HOME;
  const tagStateScope = isUserLevelCollection
    ? (statsUserName ?? context)
    : `${statsUserName ?? context}${selectedSpaceName ? `:${selectedSpaceName}` : ""}`;

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      {context === "profile" && <ProfileMode />}
      <SidebarSection ariaLabel={t("common.statistics")}>
        <StatisticsView statisticsData={statistics} navigationTarget={filterTarget} onDateSelect={() => setMobileOpen(false)} />
      </SidebarSection>
      {showViews && <ViewsSection />}
      <TagsSection tagCount={tags} navigationTarget={filterTarget} scope={tagStateScope} onSelect={() => setMobileOpen(false)} />
    </div>
  );
};

const AttachmentsSidebarContent = () => {
  const t = useTranslate();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const { attachmentSection, setAttachmentSection, setMobileOpen } = useAppSidebar();
  const { isComplete, stats } = useAttachmentLibraryStats(memoFilter);
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
  ];
  // Unlinked uploads do not belong to any Space, so "Unused" is only a Memos-level collection.
  if (!selectedSpaceName) {
    rows.push({
      value: "unused",
      icon: Trash2Icon,
      label: t("attachment-library.labels.unused"),
      count: isComplete ? stats.unused : undefined,
    });
  }
  return (
    <SidebarSection label={t("common.attachments")}>
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          state={attachmentSection === row.value ? "current" : "idle"}
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
          state={inboxFilter === row.value ? "current" : "idle"}
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
  const currentSection = location.hash.slice(1) || DEFAULT_SETTING_SECTION;
  const basic = SETTINGS_SECTIONS.filter((section) => section.scope === "basic");
  const admin = SETTINGS_SECTIONS.filter((section) => section.scope === "admin");
  const renderSections = (sections: typeof SETTINGS_SECTIONS) =>
    sections.map((section) => (
      <Link
        key={section.key}
        to={`${ROUTES.SETTING}#${section.key}`}
        onClick={() => setMobileOpen(false)}
        className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(currentSection === section.key ? "current" : "idle"))}
      >
        <SidebarRowIconSlot icon={section.icon} />
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
  const { memoDetail, closeMobileThen } = useAppSidebar();
  if (!memoDetail) return null;
  const runAndClose = (action: (() => void) | undefined) => (action ? () => closeMobileThen(action) : undefined);
  return (
    <MemoDetailSidebar
      memo={memoDetail.memo}
      parentMemo={memoDetail.parentMemo}
      parentPage={memoDetail.from}
      parentScope={memoDetail.fromScope}
      hasExplicitOrigin={memoDetail.hasExplicitOrigin}
      commentCount={memoDetail.commentCount}
      forceReadonly={memoDetail.readonly}
      onEdit={runAndClose(memoDetail.onEdit)}
      onCommentsOpen={runAndClose(memoDetail.onCommentsOpen)}
      onCommentCreate={runAndClose(memoDetail.onCommentCreate)}
      onShareImageOpen={runAndClose(memoDetail.onShareImageOpen)}
      className="pb-2"
    />
  );
};

const RouteSidebarContent = () => {
  const location = useLocation();
  const kind = getSidebarRouteKind(location.pathname);
  if (kind === "home" || kind === "archived" || kind === "explore" || kind === "profile") {
    return <CollectionSidebarContent context={kind} />;
  }
  if (kind === "views") return <ViewsSection manageActive />;
  if (kind === "attachments") return <AttachmentsSidebarContent />;
  if (kind === "inbox") return <InboxSidebarContent />;
  if (kind === "settings") return <SettingsSidebarContent />;
  if (kind === "memo") return <MemoDetailSidebarContent />;
  if (kind === "common") return <CommonSidebarContent />;
  return null;
};

interface GlobalNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
}

/**
 * The compact navigator is intentionally horizontal. Its 16px glyph plus 8px padding
 * on each side makes the collapsed control an exact 32px square. Expanding the
 * label only opens the text track, so the artwork and surface never jump.
 */
const navPillClasses = (active: boolean) =>
  cn(sidebarSurfaceVariants({ role: "navPill" }), SIDEBAR_ROW_FOCUS_CLASSES, sidebarRowStateClasses(active ? "current" : "idle"));

const NavPillLabel = ({ expanded, label, children }: { expanded: boolean; label: ReactNode; children?: ReactNode }) => (
  <span
    aria-hidden={!expanded || undefined}
    className={cn(
      "grid min-w-0 transition-[grid-template-columns,padding] duration-200 ease-out motion-reduce:transition-none",
      expanded ? "grid-cols-[1fr] ps-2" : "grid-cols-[0fr] ps-0",
    )}
  >
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <span data-sidebar-label className="max-w-[5.5rem] shrink-0 truncate text-[12px]">
        {label}
      </span>
      {children}
    </span>
  </span>
);

const GlobalNavigation = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { memoDetail, memoScope, setMemoScope, setMobileOpen } = useAppSidebar();
  const { filters } = useMemoFilterContext();
  const routeKind = getSidebarRouteKind(location.pathname);
  const resolvedScope = resolveMemoScope(location.pathname, {
    currentUsername: currentUser?.username,
    detailFrom: memoDetail?.from,
    memoArchived: memoDetail?.memo.state === State.ARCHIVED,
    fallback: memoScope,
  });
  const primaryScope: PrimaryMemoScope = resolvedScope === "archived" ? memoScope : resolvedScope;
  const routeOwnsPrimaryScope =
    resolvedScope !== "archived" && (routeKind === "home" || routeKind === "explore" || routeKind === "profile" || routeKind === "memo");
  const scopeRouteActive = routeKind === "home" || routeKind === "explore";

  useEffect(() => {
    if (routeOwnsPrimaryScope && primaryScope !== memoScope) {
      setMemoScope(primaryScope);
    }
  }, [memoScope, primaryScope, routeOwnsPrimaryScope, setMemoScope]);

  const scopeItems: Array<{ id: PrimaryMemoScope; label: string; icon: LucideIcon }> = [
    { id: "home", label: t("common.home"), icon: HouseIcon },
    { id: "explore", label: t("common.explore"), icon: EarthIcon },
  ];
  const activeScopeItem = scopeItems.find((item) => item.id === primaryScope) ?? scopeItems[0];
  const ActiveScopeIcon = activeScopeItem.icon;

  const navigateToScope = (scope: PrimaryMemoScope) => {
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
          active: routeKind === "attachments",
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
        {
          id: "about",
          label: t("common.about"),
          path: ROUTES.ABOUT,
          icon: InfoIcon,
          active: Boolean(matchPath(ROUTES.ABOUT, location.pathname)),
        },
      ];

  // Keep exactly one textual anchor in the compact horizontal navigator. The active
  // destination expands; routes outside this navigator fall back to its first control
  // without incorrectly marking that fallback as the current page.
  const activeNavigatorItemId = currentUser && scopeRouteActive ? "scope" : items.find((item) => item.active)?.id;
  const expandedNavigatorItemId = activeNavigatorItemId ?? (currentUser ? "scope" : items[0]?.id);
  const scopeExpanded = expandedNavigatorItemId === "scope";

  const scopeMenuContent = (
    <DropdownMenuContent align="start" sideOffset={4} className="flex w-36 flex-col gap-0.5">
      {scopeItems.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownMenuItem
            key={item.id}
            aria-current={item.id === resolvedScope ? "page" : undefined}
            className={cn("h-8 shrink-0 py-0 text-[13px]", item.id === resolvedScope && "bg-accent font-medium text-accent-foreground")}
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
      <nav className={cn("flex h-8 items-center gap-1", SIDEBAR_RAIL_CLASSES)} aria-label="Primary">
        {currentUser && (
          <DropdownMenu
            onOpenChange={(open, eventDetails) => {
              // Off the scope routes this is a navigation control, not a menu trigger.
              if (open && !scopeRouteActive) {
                eventDetails.cancel();
                navigateToScope(primaryScope);
              }
            }}
          >
            <Tooltip disabled={scopeExpanded}>
              {/* Keep the tooltip wrapper separate: Base UI otherwise propagates its
                  disabled state to the nested dropdown trigger. */}
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
                  <span className={SIDEBAR_NAV_LEADING_SLOT_CLASSES} aria-hidden="true">
                    <ActiveScopeIcon className="size-4 opacity-75" strokeWidth={1.8} />
                  </span>
                  <NavPillLabel expanded={scopeExpanded} label={activeScopeItem.label}>
                    {scopeRouteActive && (
                      <ChevronDownIcon
                        data-sidebar-trailing
                        className="size-3 shrink-0 opacity-55 transition-transform duration-200 ease-out group-data-[popup-open]/scope:rotate-180 motion-reduce:transition-none"
                        strokeWidth={1.8}
                      />
                    )}
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
          const expanded = item.id === expandedNavigatorItemId;
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
                <span className={SIDEBAR_NAV_LEADING_SLOT_CLASSES} aria-hidden="true">
                  <Icon className="size-4 opacity-75" strokeWidth={1.8} />
                </span>
                <NavPillLabel expanded={expanded} label={item.label} />
                {item.count != null && (
                  <span
                    data-sidebar-trailing
                    className={cn(
                      "absolute -end-0.5 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none",
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

/** The sidebar/header brand slot: collection scope on collection routes, instance brand elsewhere. */
const SidebarBrand = ({ className, size = "md" }: { className?: string; size?: "md" | "header" }) => {
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (currentUser && routeSupportsCollectionScope(location.pathname)) {
    return <SpaceSwitcher className={className} size={size} />;
  }

  return (
    <Link
      to={currentUser ? ROUTES.HOME : ROUTES.EXPLORE}
      className={cn(
        "transition-colors hover:bg-sidebar-accent/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        sidebarSurfaceVariants({ role: size === "header" ? "headerBrand" : "mobileBrand" }),
        className,
      )}
    >
      <MemosLogo compact size={size === "header" ? "header" : "md"} />
    </Link>
  );
};

const AppSidebar = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { setMobileOpen, setQuickFindOpen } = useAppSidebar();
  const { canOpen: canCompose, openEditor } = useGlobalMemoEditor();
  return (
    <aside className={cn("flex h-full w-full select-none flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div data-sidebar-header className={cn("flex h-13 shrink-0 items-center justify-between gap-2", SIDEBAR_RAIL_CLASSES)}>
        <SidebarBrand className="min-w-0" size="header" />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className={SIDEBAR_HEADER_ACTION_CLASSES}
            onClick={() => {
              setMobileOpen(false);
              setQuickFindOpen(true);
            }}
            aria-label={t("common.search")}
          >
            <SearchIcon className="size-4" strokeWidth={1.8} />
          </Button>
          {canCompose && <NewMemoAction onClick={openEditor} />}
        </div>
      </div>
      <GlobalNavigation />
      <div className="mx-3 mt-2 border-t border-border/70" />
      <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-3 [scrollbar-width:thin]", SIDEBAR_RAIL_CLASSES)}>
        <RouteSidebarContent />
      </div>
      <footer className="shrink-0 border-t border-border/70">
        {currentUser ? (
          <UserMenu />
        ) : (
          <Link
            to={ROUTES.AUTH}
            onClick={() => setMobileOpen(false)}
            className={cn(
              sidebarSurfaceVariants({ role: "account" }),
              "group text-[13px] font-medium text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
            )}
          >
            <span className={SIDEBAR_LEADING_SLOT_CLASSES}>
              <UserRoundIcon className="me-auto size-4 text-muted-foreground" strokeWidth={1.8} />
            </span>
            <span data-sidebar-label className="min-w-0 flex-1 truncate">
              {t("common.sign-in-to-memos")}
            </span>
            <ArrowRightIcon
              data-sidebar-trailing
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
  const { setMobileOpen } = useAppSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 w-full items-center justify-start gap-1 border-b border-border/70 bg-background/90 px-2 backdrop-blur-md md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        data-mobile-navigation-trigger
      >
        <MenuIcon className="size-[18px]" />
      </Button>
      <SidebarBrand className="max-w-[12rem]" size="md" />
    </header>
  );
};

export const MobileAppSidebar = () => {
  const direction = useDirection();
  const { mobileOpen, setMobileOpen, completeMobileClose } = useAppSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen} onOpenChangeComplete={completeMobileClose}>
      <SheetContent
        side={direction === "rtl" ? "right" : "left"}
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-border p-0 shadow-2xl [&>[data-slot=sheet-close]]:sr-only"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
};

export default AppSidebar;
