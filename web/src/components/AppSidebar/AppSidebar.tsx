import { useDirection } from "@base-ui/react/direction-provider";
import {
  ArchiveIcon,
  BellIcon,
  ChartColumnIcon,
  CompassIcon,
  EarthIcon,
  FileAudioIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LayoutListIcon,
  ListIcon,
  type LucideIcon,
  MenuIcon,
  PaperclipIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import { MAP_MEMO_FILTER } from "@/components/MapView/useMapMemos";
import { MemoDetailSidebar } from "@/components/MemoDetailSidebar";
import { DEFAULT_SETTING_SECTION, SETTINGS_SECTIONS } from "@/components/Settings/settingSections";
import StatisticsView from "@/components/StatisticsView";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AttachmentSection, type InboxFilter, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useInstance } from "@/contexts/InstanceContext";
import { getFilterSearch, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useNotifications, useUser } from "@/hooks/useUserQueries";
import { combineCELFilters } from "@/lib/cel-filter";
import { getMemoScopePath, getProfileUsername, type PrimaryMemoScope, resolveMemoScope } from "@/lib/memo-views";
import { userNamePrefix } from "@/lib/resource-names";
import { cn } from "@/lib/utils";
// PATCH(navigation): direct i18n import keeps the RPC-backed storage layer out of the eager sidebar bundle.
import { useNavStrings } from "@/modules/navigation/i18n";
import { collectionPathForLocation, ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { User_Role, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import CommonSidebarContent from "./CommonSidebarContent";
import { readQuickFindQuery, resolveQuickFindSubmission } from "./QuickFindDialog";
import { getSidebarRouteKind } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_FOCUS_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "./SidebarSection";
import SpaceSwitcher from "./SpaceSwitcher";
import { SIDEBAR_RAIL_CLASSES, sidebarSurfaceVariants } from "./sidebar-layout";
import TagsSection from "./TagsSection";
import ViewsSection from "./ViewsSection";

const NewMemoAction = ({ onClick }: { onClick: () => void }) => {
  const t = useTranslate();
  const label = t("editor.new-memo");

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon-compact" onClick={onClick} aria-label={label} data-new-memo-trigger />}>
        <SquarePenIcon className="size-4" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

/**
 * Always-visible sidebar search. Typing filters the current collection in place
 * (same submission path as Quick Find text mode) — no modal dialog.
 */
const InlineSidebarSearch = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const { filters, setFilters, setMemoView } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [query, setQuery] = useState(() => readQuickFindQuery(filters).query);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the box in sync when filters change from elsewhere (tags, Quick Find legacy, clear).
  useEffect(() => {
    const next = readQuickFindQuery(filters).query;
    setQuery((current) => (current === next ? current : next));
  }, [filters]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]"))) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = () => {
    const submission = resolveQuickFindSubmission(location.pathname, query, filters, "text");
    setMobileOpen(false);
    if (submission.destination) {
      setMemoView(undefined);
      navigate(submission.destination);
    } else {
      setFilters(submission.filters);
    }
  };

  return (
    <div role="search" className={cn("relative w-full", className)} data-sidebar-search>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          submit();
        }}
        placeholder={t("memo.search-placeholder")}
        aria-label={t("common.search")}
        className="pr-8 pl-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        data-sidebar-search-input
      />
      {query ? (
        <button
          type="button"
          aria-label={t("common.clear")}
          onClick={() => {
            setQuery("");
            setMobileOpen(false);
            const submission = resolveQuickFindSubmission(location.pathname, "", filters, "text");
            if (submission.destination) {
              setMemoView(undefined);
              navigate(submission.destination);
            } else {
              setFilters(submission.filters);
            }
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
};

const ProfileNavigation = () => {
  const t = useTranslate();
  const { setMobileOpen } = useAppSidebar();

  return (
    <SidebarSection label={t("common.profile")}>
      <SidebarRow state="current" icon={LayoutListIcon} label={t("common.memos")} onClick={() => setMobileOpen(false)} />
    </SidebarSection>
  );
};

/** The calendar is its own month view, so its sidebar narrows by view and tag but skips the heatmap. */
const CollectionSidebarContent = ({
  context,
  showStatistics = true,
  scopeFilter,
}: {
  context: MemoStatsContext;
  showStatistics?: boolean;
  /** A page that can only show part of the collection counts that part, so a tag never promises memos the page cannot show. */
  scopeFilter?: string;
}) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const md = useMediaQuery("md");
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const profileUsername = getProfileUsername(location.pathname);
  const { data: profileUser } = useUser(`${userNamePrefix}${profileUsername ?? ""}`, {
    enabled: context === "profile" && profileUsername !== undefined,
  });
  const statsUserName = context === "home" ? currentUser?.name : context === "profile" ? profileUser?.name : undefined;
  // User-level collections stay aligned with their unscoped feeds even when a Space is remembered.
  const isUserLevelCollection = context === "profile" || context === "archived";
  const collectionFilter = isUserLevelCollection ? undefined : memoFilter;
  const statsFilter = scopeFilter ? combineCELFilters(collectionFilter, scopeFilter) : collectionFilter;
  const { statistics, tags } = useFilteredMemoStats({
    context,
    userName: statsUserName,
    filter: statsFilter,
    enabled: authInitialized && instanceInitialized && (md || mobileOpen),
  });

  const tagStateScope = isUserLevelCollection
    ? (statsUserName ?? context)
    : `${statsUserName ?? context}${selectedSpaceName ? `:${selectedSpaceName}` : ""}`;

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      {context === "profile" && <ProfileNavigation />}
      {showStatistics && (
        <SidebarSection ariaLabel={t("common.statistics")}>
          <StatisticsView statisticsData={statistics} onDateSelect={() => setMobileOpen(false)} />
        </SidebarSection>
      )}
      {/* Every collection route narrows the same way: views (yours, so signed-in only), days, tags. */}
      {currentUser && <ViewsSection />}
      <TagsSection tagCount={tags} scope={tagStateScope} onSelect={() => setMobileOpen(false)} />
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
      parentStatus={memoDetail.parentStatus}
      onParentRetry={memoDetail.onParentRetry}
      parentPage={memoDetail.from}
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
  if (kind === "calendar") return <CollectionSidebarContent context="home" showStatistics={false} />;
  if (kind === "map") return <CollectionSidebarContent context="home" showStatistics={false} scopeFilter={MAP_MEMO_FILTER} />;
  if (kind === "attachments") return <AttachmentsSidebarContent />;
  if (kind === "inbox") return <InboxSidebarContent />;
  if (kind === "settings") return <SettingsSidebarContent />;
  if (kind === "memo") return <MemoDetailSidebarContent />;
  if (kind === "common") return <CommonSidebarContent />;
  return null;
};

/**
 * Icon rail matching the classic demo strip (top → bottom):
 * Logo · 备忘录 · 发现 · 附件 · 通知 · 导航 · (spacer) · 搜索 · 账号
 * Each destination is an icon-only size-12 tile with a right-side tooltip.
 */
const navIconClasses = (active: boolean) =>
  cn(sidebarSurfaceVariants({ role: "navIcon" }), SIDEBAR_ROW_FOCUS_CLASSES, sidebarRowStateClasses(active ? "current" : "idle"));

const NavIconButton = ({
  label,
  icon: Icon,
  active,
  onClick,
  href,
  to,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  /** Router target; may carry search so scope switches keep the current filters. */
  to?: string | { pathname: string; search: string };
  badge?: number;
}) => {
  const className = navIconClasses(Boolean(active));
  const content = (
    <>
      <Icon className={cn("size-6", active ? "opacity-100" : "opacity-80")} strokeWidth={2.25} aria-hidden="true" />
      {badge != null && badge > 0 ? (
        <span className="absolute -end-0.5 -top-0.5 flex min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-3.5 text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );
  const linkTarget = to ?? href;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          linkTarget ? (
            <Link to={linkTarget} onClick={onClick} aria-label={label} aria-current={active ? "page" : undefined} className={className} />
          ) : (
            <button type="button" onClick={onClick} aria-label={label} aria-current={active ? "page" : undefined} className={className} />
          )
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
};

const GlobalNavigation = () => {
  const t = useTranslate();
  const nav = useNavStrings();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { memoDetail, memoScope, setMemoScope, setMobileOpen } = useAppSidebar();
  const { filters } = useMemoFilterContext();
  const { data: notifications = [] } = useNotifications();
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
  const homeActive = routeKind === "home" || routeKind === "profile";
  const exploreActive = routeKind === "explore" || (routeKind === "memo" && !homeActive);
  const unreadCount = notifications.filter((item) => item.status === UserNotification_Status.UNREAD).length;

  useEffect(() => {
    if (routeOwnsPrimaryScope && primaryScope !== memoScope) {
      setMemoScope(primaryScope);
    }
  }, [memoScope, primaryScope, routeOwnsPrimaryScope, setMemoScope]);

  const navigateToScope = (scope: PrimaryMemoScope) => {
    setMemoScope(scope);
    navigate({ pathname: collectionPathForLocation(getMemoScopePath(scope), location.pathname), search: getFilterSearch(filters) });
    setMobileOpen(false);
  };

  const signedInItems: Array<{
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
    active: boolean;
    badge?: number;
    onClick?: () => void;
  }> = currentUser
    ? [
        {
          id: "home",
          label: t("common.memos"),
          path: collectionPathForLocation(getMemoScopePath("home"), location.pathname),
          icon: ChartColumnIcon,
          active: homeActive,
          onClick: () => navigateToScope("home"),
        },
        {
          id: "explore",
          label: t("common.explore"),
          path: collectionPathForLocation(getMemoScopePath("explore"), location.pathname),
          icon: EarthIcon,
          active: exploreActive,
          onClick: () => navigateToScope("explore"),
        },
        {
          id: "attachments",
          label: t("common.attachments"),
          path: collectionPathForLocation(ROUTES.ATTACHMENTS, location.pathname),
          icon: PaperclipIcon,
          active: routeKind === "attachments",
        },
        {
          id: "inbox",
          label: t("common.inbox"),
          path: ROUTES.INBOX,
          icon: BellIcon,
          active: routeKind === "inbox",
          badge: unreadCount,
        },
        {
          id: "navigation",
          label: nav.sidebarLabel,
          path: ROUTES.NAVIGATION,
          icon: CompassIcon,
          active: Boolean(matchPath(ROUTES.NAVIGATION, location.pathname)),
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

  return (
    <TooltipProvider>
      <nav className="flex h-full w-18 shrink-0 flex-col items-center gap-1 border-e border-border/70 py-2" aria-label="Primary">
        {/* Brand mark at the top of the rail, like the classic demo. Mark-only so it
            never competes with the panel's SpaceSwitcher text. */}
        <Link
          to={currentUser ? collectionPathForLocation(getMemoScopePath(primaryScope), location.pathname) : ROUTES.EXPLORE}
          onClick={() => setMobileOpen(false)}
          aria-label="Memos"
          className="mb-1 flex size-12 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <MemosLogo compact collapsed size="rail" />
        </Link>
        {signedInItems.map((item) => (
          <NavIconButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={item.active}
            // Scope destinations carry the current filter search so a switch never drops it.
            to={item.onClick ? { pathname: item.path, search: getFilterSearch(filters) } : item.path}
            badge={item.badge}
            onClick={() => {
              item.onClick?.();
              setMobileOpen(false);
            }}
          />
        ))}
        <div className="flex-1" />
        {currentUser ? (
          <div className="px-1 pb-0.5">
            <UserMenu collapsed />
          </div>
        ) : (
          <NavIconButton
            label={t("common.sign-in-to-memos")}
            icon={UserRoundIcon}
            href={ROUTES.AUTH}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </nav>
    </TooltipProvider>
  );
};

/** Signed-in users can navigate between Spaces from any page; global pages show Memos. */
const SidebarBrand = ({ className, size = "md" }: { className?: string; size?: "md" | "header" }) => {
  const currentUser = useCurrentUser();

  if (currentUser) {
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
  const { canOpen: canCompose, openEditor } = useGlobalMemoEditor();
  const location = useLocation();
  // Navigation is a full-bleed card wall: the contextual panel would only show
  // About/resource links and steal width from the page, so the rail stands alone.
  const railOnly = getSidebarRouteKind(location.pathname) === "navigation";
  return (
    <aside className={cn("flex h-full w-full select-none bg-sidebar text-sidebar-foreground", className)}>
      {/* Left icon rail — primary destinations, matching the classic demo strip. */}
      <GlobalNavigation />
      {/* Contextual panel — brand, compose, calendar/tags/settings for the current route. */}
      {!railOnly && (
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <div data-sidebar-header className={cn("flex h-13 shrink-0 items-center gap-2", SIDEBAR_RAIL_CLASSES)}>
            <SidebarBrand className="min-w-0 flex-1" size="header" />
            {canCompose && <NewMemoAction onClick={openEditor} />}
          </div>
          <div className={cn("shrink-0 pb-2", SIDEBAR_RAIL_CLASSES)}>
            <InlineSidebarSearch />
          </div>
          <div className="mx-3 border-t border-border/70" />
          <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-3 [scrollbar-width:thin]", SIDEBAR_RAIL_CLASSES)}>
            <RouteSidebarContent />
          </div>
        </div>
      )}
    </aside>
  );
};

export const MobileAppHeader = () => {
  const { setMobileOpen } = useAppSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-start gap-1 border-b border-border/70 bg-background/90 px-2 backdrop-blur-md md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-mobile-navigation-trigger>
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
