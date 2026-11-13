import { buttonClasses, Menu } from "@usememos/ui";
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceMark from "@/components/SpaceMark";
import VisibilityIcon from "@/components/VisibilityIcon";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { extractSpaceUidFromName, getDuplicateSpaceTitles } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/space_service_pb";
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
    <Menu.Root modal={false} size="sm">
      {/* The trigger starts with an icon (a space mark or the lock) inside a span, so it takes the
          package's icon-side padding itself; its gaps are the md icon gap, like a Button's. */}
      <Menu.Trigger
        className={cn(buttonClasses({ variant: "ghost", size: "md" }), "min-w-0 max-w-64 shrink ps-(--mu-row-padding-icon)")}
        disabled={disabled}
        title={summary}
        aria-label={summary}
      >
        {onSpaceChange && space && (
          <>
            <span className="flex min-w-0 max-w-32 items-center gap-1.5 sm:max-w-40">
              <SpaceIcon icon={selectedSpace?.icon} size={14} />
              <span className="truncate">{destination}</span>
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              ·
            </span>
          </>
        )}
        <span className="flex shrink-0 items-center gap-1.5">
          <VisibilityIcon visibility={value} className="text-current" />
          <span>{visibilityLabel}</span>
        </span>
        <ChevronDownIcon className="mu-icon-sm" />
      </Menu.Trigger>
      <Menu.Popup align="start" className="w-56" aria-label={t("common.visibility")}>
        {/* Two lines per audience: the description is the only place the app explains who can
            read a memo, and translations run long. The menu's fixed width makes long copy wrap
            instead of widening it; icon and check stay on the title's line. */}
        <Menu.RadioGroup value={value} onValueChange={(next) => onChange(next)}>
          {visibilityOptions.map((option) => (
            <Menu.RadioItem
              key={option.value}
              value={option.value}
              closeOnClick
              icon={<VisibilityIcon visibility={option.value} />}
              description={t(option.descriptionKey, { space: destination })}
            >
              {t(option.labelKey)}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
        {showSpaceRow && onSpaceChange && (
          <>
            <Menu.Separator />
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger
                title={space ? destination : undefined}
                icon={
                  space ? (
                    <SpaceMark icon={selectedSpace?.icon} size="sm" />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-mu-text-secondary/45"
                    >
                      <PlusIcon className="mu-icon-xs" />
                    </span>
                  )
                }
              >
                {space ? destination : <span className="text-mu-text-secondary">{t("space.add-to")}</span>}
              </Menu.SubmenuTrigger>
              <Menu.Popup className="w-56">
                {spaceChoices.map((item) => {
                  const selected = item.name === space;
                  const removeLabel = t("space.remove-from", { space: item.label });
                  return (
                    <Menu.Item
                      key={item.name}
                      title={selected ? removeLabel : item.label}
                      aria-label={selected ? removeLabel : item.label}
                      onClick={() => onSpaceChange(selected ? undefined : item.name)}
                      icon={<SpaceMark icon={item.icon} size="sm" />}
                      // The selected Space is its own off switch: a check at rest, an ✕ under the
                      // pointer or keyboard, and always an ✕ on touch, which has no hover.
                      shortcut={
                        selected ? (
                          <span aria-hidden className="flex size-3.5 items-center justify-center">
                            <CheckIcon className="mu-icon-sm in-data-highlighted:hidden pointer-coarse:hidden" />
                            <XIcon className="mu-icon-sm hidden in-data-highlighted:block pointer-coarse:block" />
                          </span>
                        ) : undefined
                      }
                    >
                      {item.label}
                    </Menu.Item>
                  );
                })}
                {isPending && <Menu.Item disabled>{t("space.loading")}</Menu.Item>}
                {isError && (
                  <Menu.Item closeOnClick={false} onClick={() => void refetch()} shortcut={t("search.retry")}>
                    <span className="text-mu-danger">{t("space.load-error")}</span>
                  </Menu.Item>
                )}
              </Menu.Popup>
            </Menu.SubmenuRoot>
          </>
        )}
      </Menu.Popup>
    </Menu.Root>
  );
};

export default AudienceMenu;
