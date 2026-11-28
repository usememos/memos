import { Button, menuClasses, Popover, Spinner, Tooltip } from "@usememos/ui";
import { ChevronsUpDownIcon, CompassIcon, HouseIcon, type LucideIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import IdentityLabel from "@/components/IdentityLabel";
import MemosLogo from "@/components/MemosLogo";
import SpaceIcon from "@/components/SpaceIcon";
import UserAvatar from "@/components/UserAvatar";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { getPlaceSwitchPath, getSpaceSwitchPath, resolveCollectionRoute } from "@/router/routes";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";
import { useTranslate } from "@/utils/i18n";
import { ScopePanelRowIcon } from "./SidebarRow";
import {
  measureSidebarPanelWidth,
  SCOPE_PANEL_ROW_CLASSES,
  SCOPE_PANEL_STACK_CLASSES,
  SIDEBAR_LEADING_SLOT_CLASSES,
  sidebarSurfaceVariants,
} from "./sidebar-layout";

/** One place in the title's list: a link on the panel's row look, filled when it is where you are. */
const PlaceRow = ({
  to,
  current,
  mark,
  label,
  detail,
  title,
  onNavigate,
}: {
  to: string;
  current: boolean;
  mark: ReactNode;
  label: string;
  /** What tells two same-named rows apart. It never truncates: a long name gives way to it. */
  detail?: string;
  /** Only for a name the row may cut off; a fixed label needs no tooltip repeating it. */
  title?: string;
  onNavigate: () => void;
}) => (
  <Link to={to} title={title} aria-current={current ? "page" : undefined} className={SCOPE_PANEL_ROW_CLASSES} onClick={onNavigate}>
    {mark}
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {detail && <span className="shrink-0 text-mu-text-secondary">{detail}</span>}
  </Link>
);

/** Up and Down walk the places, Home and End jump to the ends; Tab still leaves the list in order. */
const handlePlacesKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href]")];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  const next = {
    ArrowDown: rows[(index + 1) % rows.length],
    ArrowUp: rows[index <= 0 ? rows.length - 1 : index - 1],
    Home: rows[0],
    End: rows[rows.length - 1],
  }[event.key];
  if (!next) return;
  event.preventDefault();
  next.focus();
};

/**
 * The creator avatar draws 2px inside the slot a place's glyph fills: a solid circle carries
 * more visual weight than a line glyph, so equal boxes would make the person look larger.
 */
const CreatorAvatar = ({ avatarUrl, name, size }: { avatarUrl?: string; name?: string; size: "md" | "header" }) => (
  <span className={cn("flex shrink-0 items-center justify-center", size === "header" ? "size-5" : "size-7")}>
    <UserAvatar avatarUrl={avatarUrl} name={name} className={size === "header" ? "size-[18px]" : "size-[26px]"} />
  </span>
);

/**
 * The title's mark for a place: the bare 20px glyph with no tile behind it, like the wordmark's
 * bird beside "Memos". Home and Explore pass their symbol; a Space draws its own icon.
 * In the sidebar it fills a row's 20px artwork slot.
 */
const PlaceGlyph = ({ icon, symbol: Glyph }: { icon?: Space_Icon; symbol?: LucideIcon }) => (
  <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
    {Glyph ? <Glyph className="mu-icon size-5 shrink-0" /> : <SpaceIcon icon={icon} size={20} />}
  </span>
);

/**
 * The sidebar's title names the place you are in and opens the list of places: Home (your own
 * memos), Explore (everyone's), then your Spaces. The account lives in the sidebar's footer.
 */
function SpaceSwitcher({ className, size = "md" }: { className?: string; size?: "md" | "header" }) {
  const t = useTranslate();
  const location = useLocation();
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
  const spaceLabel = selectedSpace?.title || (selectedSpaceName ? extractSpaceUidFromName(selectedSpaceName) : "");
  const contextLabel = creatorUsername ? `${creatorLabel}${selectedSpaceName ? ` / ${spaceLabel}` : ""}` : spaceLabel;
  // Home is the user's own memos outside every Space, in any collection view.
  const atHome = Boolean(creatorUsername && creatorUsername === currentUser?.username && !selectedSpaceName);
  // Pages outside the collections (Settings, Inbox, a memo) are in no place, so nothing is marked there.
  const atExplore = resolveCollectionRoute(location.pathname).isCollection && !creatorUsername && !selectedSpaceName;
  // A signed-in user's Explore is one of their places and is named like Home. The brand stays where
  // there is no place to name: for guests, whose only collection is the instance itself, and on
  // pages outside the collections.
  const placeLabel = atHome ? t("common.home") : currentUser && atExplore ? t("common.explore") : undefined;
  const showBrand = !placeLabel && !creatorUsername && !selectedSpaceName;
  const triggerLabel = showBrand ? t("common.memos") : (placeLabel ?? contextLabel);
  const close = () => setOpen(false);
  // A Space the user is viewing without being a member of still has its row.
  const spaceRows = [
    ...spaces.map((space) => ({
      name: space.name,
      icon: space.icon,
      label: space.title,
      detail: duplicateSpaceTitles.has(space.title) ? extractSpaceUidFromName(space.name) : undefined,
    })),
    ...(selectedSpaceName && !spaces.some((space) => space.name === selectedSpaceName)
      ? [{ name: selectedSpaceName, icon: selectedSpace?.icon, label: spaceLabel, detail: undefined }]
      : []),
  ];
  const spacesUnavailable = isSpacesError && spaces.length === 0;
  // A heading with no row under it and no action beside it names nothing.
  const showSpaces = Boolean(currentUser) && (spaceRows.length > 0 || !isOtherCreator || isLoadingSpaces || spacesUnavailable);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const width = measureSidebarPanelWidth(triggerRef.current);
    if (width) setMenuWidth(width);
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          ref={triggerRef}
          aria-label={`${t("space.switch")}: ${triggerLabel}`}
          title={triggerLabel}
          className={cn(
            "memos-brand-trigger text-start transition-colors hover:bg-mu-hover/65 border border-transparent mu-focus focus-visible:border-mu-focus",
            sidebarSurfaceVariants({ role: size === "header" ? "headerBrand" : "mobileBrand" }),
            className,
          )}
        >
          {showBrand ? (
            <MemosLogo size={size} />
          ) : (
            <IdentityLabel
              // In the sidebar the mark is a row's 20px slot and the name follows 4px on, so the title
              // starts on the label rail of the rows below it.
              className={cn(size === "header" && "gap-1")}
              size={size === "header" ? "sm" : "md"}
              label={placeLabel ?? (creatorUsername && selectedSpaceName ? spaceLabel : contextLabel)}
              mark={
                placeLabel ? (
                  <PlaceGlyph symbol={atHome ? HouseIcon : CompassIcon} />
                ) : creatorUsername && selectedSpaceName ? (
                  // With a Space selected, the creator recedes to its avatar (its name stays in the tooltip)
                  // so the Space title keeps the width.
                  <span className="flex shrink-0 items-center gap-1">
                    <CreatorAvatar avatarUrl={selectedCreator?.avatarUrl} name={creatorLabel} size={size} />
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 10 20"
                      className="h-5 w-2.5 shrink-0 text-mu-text-secondary/35"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.25}
                      strokeLinecap="round"
                    >
                      <path d="M8 3 2 17" />
                    </svg>
                    <PlaceGlyph icon={selectedSpace?.icon} />
                  </span>
                ) : creatorUsername ? (
                  <CreatorAvatar avatarUrl={selectedCreator?.avatarUrl} name={creatorLabel} size={size} />
                ) : (
                  <PlaceGlyph icon={selectedSpace?.icon} />
                )
              }
            />
          )}
          <ChevronsUpDownIcon
            aria-hidden="true"
            className={cn(size === "header" ? "mu-icon-xs" : "mu-icon-sm", "shrink-0 text-mu-text-secondary/70")}
          />
        </Popover.Trigger>
        {/* One plain list at the sidebar's 28px row height. It has no scroll area of its own: a long
            list of Spaces grows the panel, and only a short window scrolls the whole of it. */}
        <Popover.Popup
          variant="list"
          align="start"
          positionMethod="fixed"
          side="bottom"
          aria-label={t("space.switch")}
          className="mu-compact w-[min(15rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto"
          style={menuWidth ? { width: `${menuWidth}px` } : undefined}
        >
          <nav aria-label={t("space.switch")} className={SCOPE_PANEL_STACK_CLASSES} onKeyDown={handlePlacesKeyDown}>
            {/* Guests have one place, Explore, which is also their way back from a creator. */}
            {currentUser && (
              <PlaceRow
                to={getPlaceSwitchPath(location, currentUser.username)}
                current={atHome}
                mark={<ScopePanelRowIcon icon={HouseIcon} />}
                label={t("common.home")}
                onNavigate={close}
              />
            )}
            <PlaceRow
              to={getPlaceSwitchPath(location)}
              current={atExplore}
              mark={<ScopePanelRowIcon icon={CompassIcon} />}
              label={t("common.explore")}
              onNavigate={close}
            />
            {showSpaces && (
              <>
                {/* The heading takes exactly one row's slot in the list, with no margin of its own, so every
                    line of the panel sits on the same 30px pitch. Any extra air above it made the step from
                    Explore to "Spaces" a different size from every other step, which read as a mistake. */}
                <div className="flex h-7 min-w-0 items-center justify-between gap-2 pe-1">
                  <h2 className="min-w-0 truncate ps-2 mu-label-xs text-mu-text-secondary select-none">{t("space.spaces")}</h2>
                  {!isOtherCreator && (
                    <Tooltip.Root>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={t("space.create")}
                            onClick={() => {
                              setOpen(false);
                              setCreateOpen(true);
                            }}
                            className="me-[3px]"
                            icon={<PlusIcon />}
                          />
                        }
                      />
                      <Tooltip.Popup>{t("space.create")}</Tooltip.Popup>
                    </Tooltip.Root>
                  )}
                </div>
                {spaceRows.map((space) => (
                  <PlaceRow
                    key={space.name}
                    to={getSpaceSwitchPath(location, space.name)}
                    // On another person's memos no place is marked: the title already says whose they are.
                    current={space.name === selectedSpaceName && !isOtherCreator}
                    mark={
                      <span className={SIDEBAR_LEADING_SLOT_CLASSES} aria-hidden="true">
                        <SpaceIcon icon={space.icon} className="text-mu-text-secondary" />
                      </span>
                    }
                    label={space.label}
                    detail={space.detail}
                    title={space.detail ? `${space.label} (${space.detail})` : space.label}
                    onNavigate={close}
                  />
                ))}
                {/* Status rows keep a row's slot and reserved border, so their text starts on the labels' line. */}
                {isLoadingSpaces && (
                  <div className={cn(menuClasses().item, "border border-transparent")} data-disabled="">
                    <span className={SIDEBAR_LEADING_SLOT_CLASSES}>
                      <Spinner size="sm" label={t("space.loading")} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t("space.loading")}</span>
                  </div>
                )}
                {spacesUnavailable && (
                  <div className={cn(menuClasses().item, "border border-transparent")} data-disabled="">
                    <span className={SIDEBAR_LEADING_SLOT_CLASSES} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{t("space.load-error")}</span>
                  </div>
                )}
              </>
            )}
          </nav>
        </Popover.Popup>
      </Popover.Root>
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={selectSpace} />
    </>
  );
}

export default SpaceSwitcher;
