import { CheckIcon, ChevronsUpDownIcon, LoaderCircleIcon, type LucideIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

// Icons in action and status rows sit in a glyph-width slot so every label in the menu
// starts on the same text rail as the context rows.
const RowIcon = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span className="flex size-5 shrink-0 items-center justify-center">
    <Icon className={cn("size-3.5", className)} />
  </span>
);

const ContextItem = ({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) => (
  <DropdownMenuItem role="menuitemradio" aria-checked={selected} closeOnClick onClick={onSelect} className={cn(selected && "bg-accent/60")}>
    {children}
    {selected && <CheckIcon className="ms-auto size-3.5 shrink-0 text-primary" />}
  </DropdownMenuItem>
);

function SpaceSwitcher({ className }: { className?: string }) {
  const t = useTranslate();
  const { spaces, selectedSpace, selectedSpaceName, isLoadingSpaces, isSpacesError, selectMemos, selectSpace } = useSpaceContext();
  const [createOpen, setCreateOpen] = useState(false);
  const currentContextLabel = selectedSpaceName ? selectedSpace?.title || t("space.current") : t("common.memos");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`${t("space.switch")}: ${currentContextLabel}`}
              className={cn(
                "group flex h-9 min-w-0 max-w-full items-center gap-1 rounded-md px-0.5 text-start focus-visible:outline-none",
                className,
              )}
            />
          }
        >
          <span className="flex min-w-0 flex-1 items-center">
            {selectedSpaceName ? (
              <>
                <SpaceMark space={selectedSpace} />
                <span className="ms-1.5 min-w-0 truncate text-[14px] font-medium tracking-[-0.01em] text-foreground">
                  {selectedSpace?.title || t("space.current")}
                </span>
              </>
            ) : (
              <MemosLogo compact />
            )}
          </span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent size="sm" align="start" sideOffset={4} className="w-[min(15rem,calc(100vw-1rem))]">
          <DropdownMenuGroup>
            <ContextItem selected={!selectedSpaceName} onSelect={selectMemos}>
              <span className="min-w-0 flex-1">
                <MemosLogo compact size="sm" />
              </span>
            </ContextItem>
            {spaces.length > 0 && (
              <>
                <DropdownMenuLabel className="pb-0.5 pt-1.5 font-normal text-muted-foreground">{t("space.spaces")}</DropdownMenuLabel>
                {spaces.map((space) => (
                  <ContextItem key={space.name} selected={space.name === selectedSpaceName} onSelect={() => selectSpace(space)}>
                    <SpaceMark space={space} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{space.title}</span>
                  </ContextItem>
                ))}
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
