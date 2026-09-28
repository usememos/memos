import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceMark from "@/components/SpaceMark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { extractSpaceUidFromName, getDuplicateSpaceTitles } from "@/lib/space-display";
import type { Space_Icon } from "@/types/proto/api/v1/space_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import type { AudienceMenuProps } from "../types";

/**
 * One quiet control for a memo's audience and, where the host allows it, its Space.
 *
 * Audience comes first: every memo has one. Space is optional, so it is a single
 * row at the bottom that never names the empty state — "Add to space" before a
 * choice, the Space itself after. The selected Space toggles back off.
 */
const AudienceMenu = ({ value, onChange, space, onSpaceChange, disabled }: AudienceMenuProps) => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { data: spaces = [], isPending, isError, refetch } = useSpaces(user?.name, { enabled: Boolean(onSpaceChange) });
  const visibilityOptions = getAssignableVisibilityOptions({ hasSpacePlacement: Boolean(space), current: value });
  const currentOption = getVisibilityOption(value);
  const visibilityLabel = currentOption ? t(currentOption.labelKey) : "";
  const duplicates = getDuplicateSpaceTitles(spaces);
  const spaceLabel = (item: (typeof spaces)[number]) =>
    duplicates.has(item.title) ? `${item.title} (${extractSpaceUidFromName(item.name)})` : item.title;
  const selectedSpace = spaces.find((item) => item.name === space);
  const destination = space ? (selectedSpace ? spaceLabel(selectedSpace) : extractSpaceUidFromName(space)) : "";
  const summary = onSpaceChange && space ? `${destination} · ${visibilityLabel}` : visibilityLabel;
  // Nothing to add to and nothing to remove from: the Space row would be a dead end.
  const showSpaceRow = Boolean(onSpaceChange) && (Boolean(space) || isPending || isError || spaces.length > 0);
  // A placement outside the member list (e.g. the author left the Space) stays
  // visible so it can still be removed.
  const spaceChoices: { name: string; label: string; icon?: Space_Icon }[] = [
    ...(space && !selectedSpace ? [{ name: space, label: destination }] : []),
    ...spaces.map((item) => ({ name: item.name, label: spaceLabel(item), icon: item.icon })),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="quiet" size="sm" className="min-w-0 max-w-64 shrink gap-1 text-muted-foreground" disabled={disabled} />}
        title={summary}
        aria-label={summary}
      >
        {onSpaceChange && space && (
          <>
            <span className="flex min-w-0 max-w-32 items-center gap-1 sm:max-w-40">
              <SpaceIcon icon={selectedSpace?.icon} size={14} />
              <span className="truncate">{destination}</span>
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              ·
            </span>
          </>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <VisibilityIcon visibility={value} className="size-3.5 text-current" />
          <span>{visibilityLabel}</span>
        </span>
        <ChevronDownIcon className="size-3 opacity-50" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" size="sm" className="w-56" aria-label={t("common.visibility")}>
        {/* Two lines per audience: the description is the only place the app explains who can
            read a memo, and translations run long. The menu's fixed width makes long copy wrap
            instead of widening it; icon and check stay on the title's line. */}
        {visibilityOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <span aria-hidden className="flex h-4.5 w-5 shrink-0 items-center justify-center self-start">
              <VisibilityIcon visibility={option.value} className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span>{t(option.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{t(option.descriptionKey, { space: destination })}</span>
            </span>
            <span aria-hidden className="ms-auto flex h-4.5 w-3.5 shrink-0 items-center justify-center self-start">
              {option.value === value && <CheckIcon className="size-3.5" />}
            </span>
          </DropdownMenuItem>
        ))}
        {showSpaceRow && onSpaceChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger title={space ? destination : undefined}>
                {space ? (
                  <>
                    <SpaceMark icon={selectedSpace?.icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{destination}</span>
                  </>
                ) : (
                  <>
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-muted-foreground/45"
                    >
                      <PlusIcon className="size-3" strokeWidth={2} />
                    </span>
                    <span className="flex-1 text-muted-foreground">{t("space.add-to")}</span>
                  </>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {spaceChoices.map((item) => {
                  const selected = item.name === space;
                  const removeLabel = t("space.remove-from", { space: item.label });
                  return (
                    <DropdownMenuItem
                      key={item.name}
                      title={selected ? removeLabel : item.label}
                      aria-label={selected ? removeLabel : item.label}
                      onClick={() => onSpaceChange(selected ? undefined : item.name)}
                    >
                      <SpaceMark icon={item.icon} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {/* The selected Space is its own off switch: a check at rest, an ✕ under the
                          pointer or keyboard, and always an ✕ on touch, which has no hover. */}
                      {selected && (
                        <span aria-hidden className="ms-auto flex size-3.5 shrink-0 items-center justify-center">
                          <CheckIcon className="size-3.5 in-data-highlighted:hidden pointer-coarse:hidden" />
                          <XIcon className="hidden size-3.5 in-data-highlighted:block pointer-coarse:block" />
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {isPending && <DropdownMenuItem disabled>{t("space.loading")}</DropdownMenuItem>}
                {isError && (
                  <DropdownMenuItem closeOnClick={false} onClick={() => void refetch()}>
                    <span className="text-destructive">{t("space.load-error")}</span>
                    <span className="ms-auto text-muted-foreground">{t("search.retry")}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AudienceMenu;
