import { Button, menuClasses, Popover, Select, Spinner, Tooltip } from "@usememos/ui";
import { ArrowLeftIcon, AstroidIcon, ChevronsUpDownIcon, CompassIcon, HouseIcon, type LucideIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import IdentityLabel from "@/components/IdentityLabel";
import MemosLogo from "@/components/MemosLogo";
import SpaceMark from "@/components/SpaceMark";
import SpaceSelectItem from "@/components/SpaceSelectItem";
import UserAvatar from "@/components/UserAvatar";
import UserMenu from "@/components/UserMenu";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { buildCollectionPath, getCreatorSwitchPath, getSpaceSwitchPath, ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { ScopePanelRowIcon } from "./SidebarRow";
import SidebarSectionHeader from "./SidebarSectionHeader";
import { SCOPE_PANEL_ROW_CLASSES, SIDEBAR_LEADING_SLOT_CLASSES, sidebarSurfaceVariants } from "./sidebar-layout";

/** One half of the Home/Explore segmented control; the current half is filled. */
const BrowseLink = ({ to, current, icon: Icon, label }: { to: string; current: boolean; icon: LucideIcon; label: string }) => (
  <Link
    to={to}
    aria-current={current ? "page" : undefined}
    className={cn(
      "flex h-(--mu-row-height) min-w-0 items-center gap-1.5 rounded-mu-sm px-1.5 mu-label hover:bg-mu-canvas/60 border border-transparent mu-focus focus-visible:border-mu-focus",
      current && "bg-mu-canvas hover:bg-mu-canvas",
    )}
  >
    <span className={SIDEBAR_LEADING_SLOT_CLASSES}>
      <Icon aria-hidden="true" className="mu-icon" />
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
            <MemosLogo size={size === "header" ? "header" : "md"} />
          ) : (
            <IdentityLabel
              label={creatorUsername && selectedSpaceName ? spaceLabel : contextLabel}
              mark={
                creatorUsername && selectedSpaceName ? (
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
                    <SpaceMark icon={selectedSpace?.icon} size={size === "header" ? "header" : "md"} />
                  </span>
                ) : creatorUsername ? (
                  <CreatorAvatar avatarUrl={selectedCreator?.avatarUrl} name={creatorLabel} size={size} />
                ) : (
                  <SpaceMark icon={selectedSpace?.icon} size={size === "header" ? "header" : "md"} />
                )
              }
            />
          )}
          <ChevronsUpDownIcon
            aria-hidden="true"
            className={cn(size === "header" ? "mu-icon-xs" : "mu-icon-sm", "shrink-0 text-mu-text-secondary/70")}
          />
        </Popover.Trigger>
        {/* A list of rows beside the sidebar, at its 28px row height. */}
        <Popover.Popup
          variant="list"
          align="start"
          positionMethod="fixed"
          side="bottom"
          className="mu-compact w-[min(15rem,calc(100vw-1rem))] max-h-[min(27rem,calc(100dvh-5rem))] overflow-y-auto"
          style={menuWidth ? { width: `${menuWidth}px` } : undefined}
        >
          {/* Guests have one collection, Explore, so they only get a way back to it from a creator. */}
          {(currentUser || isOtherCreator) && (
            <>
              <div className="flex flex-col">
                {isOtherCreator ? (
                  <Link to={returnPath} className={SCOPE_PANEL_ROW_CLASSES}>
                    <ScopePanelRowIcon icon={ArrowLeftIcon} className="rtl:rotate-180" />
                    {t("memo.back-to", { source: t(currentUser ? "common.home" : "common.explore") })}
                  </Link>
                ) : (
                  currentUser && (
                    <>
                      <SidebarSectionHeader>{t("common.browse")}</SidebarSectionHeader>
                      <nav aria-label={t("common.browse")} className="grid grid-cols-2 gap-0.5 rounded-mu-md bg-mu-well p-0.5">
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
                          )
                        }
                      >
                        {t("space.spaces")}
                      </SidebarSectionHeader>
                    </div>
                    <Select.Root
                      value={selectedSpaceName ?? "all"}
                      items={[
                        { value: "all", label: allSpacesLabel },
                        ...spaces.map((space) => ({ value: space.name, label: space.title })),
                        ...(selectedSpaceName && !spaces.some((space) => space.name === selectedSpaceName)
                          ? [{ value: selectedSpaceName, label: spaceLabel }]
                          : []),
                      ]}
                      onValueChange={(value) => {
                        if (value !== null) navigate(getSpaceSwitchPath(location, value === "all" ? undefined : value));
                      }}
                    >
                      {/* The current Space is switched in place, so the picker is a ghost row, not a key. */}
                      <Select.Trigger
                        variant="ghost"
                        aria-label={t("space.switch")}
                        title={selectedSpaceName ? spaceLabel : allSpacesLabel}
                        className="w-full"
                      >
                        {selectedSpaceName ? <SpaceMark icon={selectedSpace?.icon} size="sm" /> : <ScopePanelRowIcon icon={AstroidIcon} />}
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popup
                        className="max-h-64 w-(--anchor-width) min-w-0 max-w-[calc(100vw-2rem)]"
                        align="start"
                        positionMethod="fixed"
                      >
                        <Select.Item value="all" icon={<AstroidIcon />}>
                          {allSpacesLabel}
                        </Select.Item>
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
                          <Select.Item value="loading" disabled icon={<Spinner size="sm" label={t("space.loading")} />}>
                            {t("space.loading")}
                          </Select.Item>
                        )}
                        {isSpacesError && spaces.length === 0 && (
                          <Select.Item value="error" disabled>
                            {t("space.load-error")}
                          </Select.Item>
                        )}
                      </Select.Popup>
                    </Select.Root>
                  </>
                )}
              </div>
              <div role="separator" className={menuClasses().separator} />
            </>
          )}
          <UserMenu onClose={() => setOpen(false)} />
        </Popover.Popup>
      </Popover.Root>
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={selectSpace} />
    </>
  );
}

export default SpaceSwitcher;
