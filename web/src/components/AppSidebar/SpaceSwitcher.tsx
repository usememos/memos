import { CheckIcon, ChevronDownIcon, LoaderCircleIcon, type LucideIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import MemosLogo from "@/components/MemosLogo";
import SpaceMark from "@/components/SpaceMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { extractSpaceUidFromName, formatSpaceUidForDisplay } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { sidebarSurfaceVariants } from "./sidebar-layout";

// Icons in action and status rows sit in a glyph-width slot so every label in the menu
// starts on the same text rail as the context rows.
const RowIcon = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span className="flex size-5 shrink-0 items-center justify-center">
    <Icon className={cn("size-3.5", className)} />
  </span>
);

const ContextItem = ({
  selected,
  onSelect,
  children,
  ariaLabel,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) => (
  <DropdownMenuItem
    role="menuitemradio"
    aria-checked={selected}
    aria-label={ariaLabel}
    title={ariaLabel}
    closeOnClick
    onClick={onSelect}
    className={cn("min-w-0", selected && "bg-accent/60")}
  >
    {children}
    {selected && <CheckIcon className="ms-auto size-3.5 shrink-0 text-primary" />}
  </DropdownMenuItem>
);

function SpaceSwitcher({ className, size = "md" }: { className?: string; size?: "md" | "header" }) {
  const t = useTranslate();
  const { spaces, duplicateSpaceTitles, selectedSpace, selectedSpaceName, isLoadingSpaces, isSpacesError, selectMemos, selectSpace } =
    useSpaceContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedSpaceIdentity = selectedSpace?.name || selectedSpaceName || "";
  const selectedSpaceUid = selectedSpaceIdentity ? extractSpaceUidFromName(selectedSpaceIdentity) : "";
  const showSelectedSpaceUid = selectedSpace ? duplicateSpaceTitles.has(selectedSpace.title) : Boolean(selectedSpaceName);
  const currentContextLabel = selectedSpaceName
    ? `${selectedSpace?.title || t("space.current")}${showSelectedSpaceUid && selectedSpaceUid ? ` (${selectedSpaceUid})` : ""}`
    : t("common.memos");
  const brandSize = size === "header" ? "header" : "md";
  const spaceMarkSize = size === "header" ? "sm" : "md";

  const handleMenuOpenChange = (open: boolean) => {
    if (!open) return;

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
      <DropdownMenu onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <button
              ref={triggerRef}
              type="button"
              aria-label={`${t("space.switch")}: ${currentContextLabel}`}
              title={currentContextLabel}
              className={cn(
                "group text-start transition-colors hover:bg-sidebar-accent/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                size === "header" ? sidebarSurfaceVariants({ role: "headerBrand" }) : sidebarSurfaceVariants({ role: "mobileBrand" }),
                className,
              )}
            />
          }
        >
          <span className={cn("flex min-w-0 items-center overflow-hidden", size === "header" ? "gap-1" : "gap-1.5")}>
            {selectedSpaceName ? (
              <>
                <SpaceMark size={spaceMarkSize} />
                <span data-sidebar-label className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
                  <span
                    className={cn(
                      "block truncate text-[14px] tracking-[-0.01em] text-foreground",
                      size === "header" ? "font-semibold leading-5" : "font-medium leading-4",
                    )}
                  >
                    {selectedSpace?.title || t("space.current")}
                  </span>
                  {size !== "header" && showSelectedSpaceUid && selectedSpaceUid ? (
                    <span
                      aria-hidden="true"
                      title={selectedSpaceUid}
                      className="block truncate font-mono text-[10px] leading-3 text-muted-foreground"
                    >
                      {formatSpaceUidForDisplay(selectedSpaceIdentity)}
                    </span>
                  ) : null}
                </span>
              </>
            ) : (
              <MemosLogo compact size={brandSize} />
            )}
          </span>
          <ChevronDownIcon
            className="size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-150 group-data-[popup-open]:rotate-180 motion-reduce:transition-none"
            strokeWidth={1.8}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          size="sm"
          align="start"
          sideOffset={4}
          className="w-[min(15rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]"
          style={menuWidth ? { width: `${menuWidth}px` } : undefined}
        >
          <DropdownMenuGroup>
            <ContextItem selected={!selectedSpaceName} onSelect={selectMemos}>
              <span className="min-w-0 flex-1">
                <MemosLogo compact size="sm" />
              </span>
            </ContextItem>
            {spaces.length > 0 && (
              <>
                <DropdownMenuLabel className="pb-0.5 pt-1.5 font-normal text-muted-foreground">{t("space.spaces")}</DropdownMenuLabel>
                {spaces.map((space) => {
                  const uid = extractSpaceUidFromName(space.name);
                  const showUid = duplicateSpaceTitles.has(space.title);

                  return (
                    <ContextItem
                      key={space.name}
                      selected={space.name === selectedSpaceName}
                      onSelect={() => selectSpace(space)}
                      ariaLabel={showUid && uid ? `${space.title} (${uid})` : space.title}
                    >
                      <SpaceMark size="sm" />
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block max-w-full truncate font-medium">{space.title}</span>
                        {showUid && uid ? (
                          <span
                            aria-hidden="true"
                            title={uid}
                            className="block truncate font-mono text-[10px] leading-3.5 text-muted-foreground"
                          >
                            {formatSpaceUidForDisplay(space.name)}
                          </span>
                        ) : null}
                      </span>
                    </ContextItem>
                  );
                })}
              </>
            )}
          </DropdownMenuGroup>
          {/* isLoadingSpaces implies no data yet, so these only ever show on an empty list. */}
          {isLoadingSpaces && (
            <DropdownMenuItem disabled>
              <RowIcon icon={LoaderCircleIcon} className="animate-spin" />
              {t("space.loading")}
            </DropdownMenuItem>
          )}
          {isSpacesError && spaces.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="size-5 shrink-0" />
              {t("space.load-error")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <RowIcon icon={PlusIcon} />
            {t("space.create")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={selectSpace} />
    </>
  );
}

export default SpaceSwitcher;
