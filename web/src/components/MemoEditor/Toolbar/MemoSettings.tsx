import { Radio } from "@base-ui/react/radio";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceMark from "@/components/SpaceMark";
import SpaceSelectItem from "@/components/SpaceSelectItem";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VisibilityIcon from "@/components/VisibilityIcon";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { extractSpaceUidFromName, getDuplicateSpaceTitles } from "@/lib/space-display";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import type { MemoSettingsProps } from "../types";

const NO_SPACE = "no-space";

/** One quiet control for audience and, in an unscoped new composer, destination. */
const MemoSettings = ({ value, onChange, space, onSpaceChange, disabled }: MemoSettingsProps) => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { data: spaces = [], isPending, isError, refetch } = useSpaces(user?.name, { enabled: Boolean(onSpaceChange) });
  const [open, setOpen] = useState(false);
  const spaceId = useId();
  const visibilityOptions = getAssignableVisibilityOptions({ hasSpacePlacement: Boolean(space), current: value });
  const currentOption = getVisibilityOption(value);
  const visibilityLabel = currentOption ? t(currentOption.labelKey) : "";
  const duplicates = getDuplicateSpaceTitles(spaces);
  const spaceLabel = (item: (typeof spaces)[number]) =>
    duplicates.has(item.title) ? `${item.title} (${extractSpaceUidFromName(item.name)})` : item.title;
  const selectedSpace = spaces.find((item) => item.name === space);
  const destination = space ? (selectedSpace ? spaceLabel(selectedSpace) : extractSpaceUidFromName(space)) : t("space.no-space");
  const summary = onSpaceChange && space ? `${destination} · ${visibilityLabel}` : visibilityLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="quiet" size="sm" className="min-w-0 max-w-64 shrink gap-1 text-muted-foreground" disabled={disabled} />}
        title={summary}
        aria-label={summary}
      >
        {onSpaceChange && space && (
          <>
            <span className="flex min-w-0 max-w-32 items-center gap-1 sm:max-w-40">
              <SpaceIcon icon={selectedSpace?.icon} />
              <span className="truncate">{destination}</span>
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              ·
            </span>
          </>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <VisibilityIcon visibility={value} className="text-current" />
          <span>{visibilityLabel}</span>
        </span>
        <ChevronDownIcon className="size-3 opacity-50" strokeWidth={1.8} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-1" aria-label={t("common.visibility")}>
        {onSpaceChange && <div className="px-2 py-1 text-xs text-muted-foreground">{t("common.visibility")}</div>}
        <RadioGroup
          value={value}
          onValueChange={(next) => {
            onChange(next as Visibility);
            setOpen(false);
          }}
          disabled={disabled}
          aria-label={t("common.visibility")}
          className="gap-0"
        >
          {visibilityOptions.map((option) => (
            <Radio.Root
              key={option.value}
              value={option.value}
              className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-start text-ui outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
            >
              <VisibilityIcon visibility={option.value} className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block">{t(option.labelKey)}</span>
                <span className="block text-2xs text-muted-foreground">{t(option.descriptionKey)}</span>
              </span>
              <span className="size-3.5 shrink-0">
                <Radio.Indicator>
                  <CheckIcon className="size-3.5 text-primary" />
                </Radio.Indicator>
              </span>
            </Radio.Root>
          ))}
        </RadioGroup>
        {onSpaceChange && (
          <div className="mt-1 grid min-w-0 gap-1.5 border-t px-2 pt-2 pb-1">
            <label id={spaceId} className="text-xs text-muted-foreground" htmlFor={`${spaceId}-select`}>
              {t("space.current")}
            </label>
            <Select
              value={space || NO_SPACE}
              onValueChange={(next) => onSpaceChange(next === NO_SPACE ? undefined : next)}
              disabled={disabled}
            >
              <SelectTrigger
                id={`${spaceId}-select`}
                size="sm"
                className="w-full min-w-0 text-ui"
                aria-labelledby={spaceId}
                title={destination}
              >
                <SelectValue className="min-w-0 flex-1">
                  {space && <SpaceMark icon={selectedSpace?.icon} size="sm" />}
                  <span className="truncate">{destination}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[min(16rem,var(--available-height))] w-(--anchor-width) min-w-0 max-w-[calc(100vw-2rem)]">
                <SelectItem value={NO_SPACE} className="text-ui">
                  {t("space.no-space")}
                </SelectItem>
                {space && !selectedSpace && (
                  <SelectItem
                    value={space}
                    disabled
                    className="[&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 [&>div:first-child]:truncate"
                    title={destination}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SpaceMark size="sm" />
                      <span className="truncate">{destination}</span>
                    </span>
                  </SelectItem>
                )}
                {spaces.map((item) => (
                  <SpaceSelectItem key={item.name} value={item.name} label={spaceLabel(item)} icon={item.icon} className="text-ui" />
                ))}
              </SelectContent>
            </Select>
            {isPending && (
              <p role="status" className="text-xs text-muted-foreground">
                {t("space.loading")}
              </p>
            )}
            {isError && (
              <p role="alert" className="text-xs text-destructive">
                {t("space.load-error")}{" "}
                <button type="button" className="underline" onClick={() => void refetch()}>
                  {t("search.retry")}
                </button>
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MemoSettings;
