import {
  ArrowLeftIcon,
  AstroidIcon,
  ChevronsUpDownIcon,
  CompassIcon,
  HouseIcon,
  LoaderCircleIcon,
  type LucideIcon,
  PlusIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import MemosLogo from "@/components/MemosLogo";
import SpaceMark from "@/components/SpaceMark";
import SpaceSelectItem from "@/components/SpaceSelectItem";
import UserAvatar from "@/components/UserAvatar";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { buildCollectionPath, getCreatorSwitchPath, getSpaceSwitchPath, ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import SidebarSectionHeader from "./SidebarSectionHeader";
import { sidebarSurfaceVariants } from "./sidebar-layout";

/** One half of the Home/Explore segmented control; the current half is raised. */
const BrowseLink = ({ to, current, icon: Icon, label }: { to: string; current: boolean; icon: LucideIcon; label: string }) => (
  <Link
    to={to}
    aria-current={current ? "page" : undefined}
    className={cn(
      "flex h-7 min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-ui font-medium hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      current && "bg-background ring-1 ring-border shadow-sm hover:bg-background",
    )}
  >
    <span className="flex size-5 shrink-0 items-center justify-center">
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
    </span>
    <span className="min-w-0 truncate">{label}</span>
  </Link>
);

/**
 * The creator avatar shares the Space mark's slot but draws 2px smaller: a solid circle carries
 * more visual weight than the pale Space tile, so equal boxes would make the person look larger.
 */
const CreatorAvatar = ({ avatarUrl, name, size }: { avatarUrl?: string; name?: string; size: "md" | "header" }) => (
  <span className={cn("flex shrink-0 items-center justify-center", size === "header" ? "size-6" : "size-7")}>
    <UserAvatar avatarUrl={avatarUrl} name={name} className={size === "header" ? "size-[22px]" : "size-[26px]"} />
  </span>
);

function SpaceSwitcher({ className, size = "md" }: { className?: string; size?: "md" | "header" }) {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { spaces, duplicateSpaceTitles, selectedSpace, selectedSpaceName, creatorUsername, isLoadingSpaces, isSpacesError, selectSpace } =
    useSpaceContext();
  const { data: otherCreator } = useUser(`users/${creatorUsername ?? ""}`, {
    enabled: Boolean(creatorUsername && creatorUsername !== currentUser?.username),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedCreator = creatorUsername ? (creatorUsername === currentUser?.username ? currentUser : otherCreator) : undefined;
  const creatorLabel = selectedCreator?.displayName || selectedCreator?.username || creatorUsername;
  const isOtherCreator = Boolean(creatorUsername && creatorUsername !== currentUser?.username);
  const returnPath = currentUser ? buildCollectionPath(ROUTES.HOME, selectedSpaceName) : ROUTES.EXPLORE;
  const spaceLabel = selectedSpace?.title || (selectedSpaceName ? extractSpaceUidFromName(selectedSpaceName) : "");
  const contextLabel = creatorUsername ? `${creatorLabel}${selectedSpaceName ? ` / ${spaceLabel}` : ""}` : spaceLabel;
  const showBrand = !creatorUsername && !selectedSpaceName;
  const triggerLabel = showBrand ? t("common.memos") : contextLabel;
  const allSpacesLabel = t("space.all-spaces");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const trigger = triggerRef.current;
    const sidebar = trigger?.closest("aside");
    if (!trigger || !sidebar) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const inlineInset = Math.min(Math.abs(triggerRect.left - sidebarRect.left), Math.abs(sidebarRect.right - triggerRect.right));
    const width = Math.floor(sidebarRect.width - inlineInset * 2);
    if (width > 0) setMenuWidth(width);
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          ref={triggerRef}
          aria-label={`${t("space.switch")}: ${triggerLabel}`}
          title={triggerLabel}
          className={cn(
            "text-start transition-colors hover:bg-sidebar-accent/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
            sidebarSurfaceVariants({ role: size === "header" ? "headerBrand" : "mobileBrand" }),
            className,
          )}
        >
          {showBrand ? (
            <MemosLogo compact size={size === "header" ? "header" : "md"} />
          ) : (
            <span className="flex min-w-0 items-center gap-2 overflow-hidden">
              {creatorUsername && selectedSpaceName ? (
                // With a Space selected, the creator recedes to its avatar (its name stays in the tooltip)
                // so the Space title keeps the width.
                <span className="flex shrink-0 items-center gap-1">
                  <CreatorAvatar avatarUrl={selectedCreator?.avatarUrl} name={creatorLabel} size={size} />
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 10 20"
                    className="h-5 w-2.5 shrink-0 text-muted-foreground/35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.25}
                    strokeLinecap="round"
                  >
                    <path d="M8 3 2 17" />
                  </svg>
                  <SpaceMark icon={selectedSpace?.icon} size={size === "header" ? "header" : "md"} />
                </span>
              ) : creatorUsername ? (
                <CreatorAvatar avatarUrl={selectedCreator?.avatarUrl} name={creatorLabel} size={size} />
              ) : (
                <SpaceMark icon={selectedSpace?.icon} size={size === "header" ? "header" : "md"} />
              )}
              <span
                data-sidebar-label
                className={cn(
                  "min-w-0 truncate tracking-[-0.01em]",
                  size === "header" ? "text-[15px] font-semibold leading-5" : "text-[14px] font-medium leading-4",
                )}
              >
                {creatorUsername && selectedSpaceName ? spaceLabel : contextLabel}
              </span>
            </span>
          )}
          <ChevronsUpDownIcon
            aria-hidden="true"
            className={cn("shrink-0 text-muted-foreground/70", size === "header" ? "size-3" : "size-3.5")}
            strokeWidth={1.8}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-[min(15rem,calc(100vw-1rem))] max-h-[min(27rem,calc(100dvh-5rem))] overflow-y-auto p-0"
          style={menuWidth ? { width: `${menuWidth}px` } : undefined}
        >
          {/* Guests have one collection, Explore, so they only get a way back to it from a creator. */}
          {(currentUser || isOtherCreator) && (
            <div className="flex flex-col p-1">
              {isOtherCreator ? (
                <Link
                  to={returnPath}
                  className="flex h-7 items-center gap-1.5 rounded-sm px-2 text-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <ArrowLeftIcon aria-hidden="true" className="size-3.5 rtl:rotate-180" strokeWidth={1.8} />
                  </span>
                  {t("memo.back-to", { source: t(currentUser ? "common.home" : "common.explore") })}
                </Link>
              ) : (
                currentUser && (
                  <>
                    <SidebarSectionHeader>{t("common.browse")}</SidebarSectionHeader>
                    <nav aria-label={t("common.browse")} className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5">
                      <BrowseLink
                        to={getCreatorSwitchPath(location, currentUser.username, currentUser.username)}
                        current={Boolean(creatorUsername)}
                        icon={HouseIcon}
                        label={t("common.home")}
                      />
                      <BrowseLink
                        to={getCreatorSwitchPath(location, undefined, currentUser.username)}
                        current={!creatorUsername}
                        icon={CompassIcon}
                        label={t("common.explore")}
                      />
                    </nav>
                  </>
                )
              )}
              {currentUser && (
                <>
                  <div className="mt-1">
                    <SidebarSectionHeader
                      action={
                        !isOtherCreator && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("space.create")}
                            title={t("space.create")}
                            onClick={() => {
                              setOpen(false);
                              setCreateOpen(true);
                            }}
                            className="me-[3px] text-muted-foreground hover:text-foreground"
                          >
                            <PlusIcon className="size-3.5" strokeWidth={1.8} />
                          </Button>
                        )
                      }
                    >
                      {t("space.spaces")}
                    </SidebarSectionHeader>
                  </div>
                  <Select
                    value={selectedSpaceName ?? "all"}
                    onValueChange={(value) => {
                      if (value !== null) navigate(getSpaceSwitchPath(location, value === "all" ? undefined : value));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("space.switch")}
                      title={selectedSpaceName ? spaceLabel : allSpacesLabel}
                      // The border takes 1px of the row inset; the gap matches the panel rows.
                      className="w-full text-ui shadow-none data-[size=sm]:gap-1.5 data-[size=sm]:ps-[7px]"
                    >
                      {selectedSpaceName ? (
                        <SpaceMark icon={selectedSpace?.icon} size="sm" />
                      ) : (
                        <span className="flex size-5 shrink-0 items-center justify-center">
                          <AstroidIcon className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-start">{selectedSpaceName ? spaceLabel : allSpacesLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="max-h-64 w-(--anchor-width) min-w-0 max-w-[calc(100vw-2rem)]" align="start">
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <AstroidIcon className="size-4" />
                          {allSpacesLabel}
                        </span>
                      </SelectItem>
                      {spaces.map((space) => {
                        const uid = extractSpaceUidFromName(space.name);
                        return (
                          <SpaceSelectItem
                            key={space.name}
                            value={space.name}
                            label={duplicateSpaceTitles.has(space.title) ? `${space.title} (${uid})` : space.title}
                            icon={space.icon}
                          />
                        );
                      })}
                      {isLoadingSpaces && (
                        <SelectItem value="loading" disabled>
                          <LoaderCircleIcon className="size-4 animate-spin" />
                          {t("space.loading")}
                        </SelectItem>
                      )}
                      {isSpacesError && spaces.length === 0 && (
                        <SelectItem value="error" disabled>
                          {t("space.load-error")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}
          <UserMenu onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={selectSpace} />
    </>
  );
}

export default SpaceSwitcher;
