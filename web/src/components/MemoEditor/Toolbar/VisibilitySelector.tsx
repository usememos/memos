import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import type { VisibilitySelectorProps } from "../types";

const VisibilitySelector = (props: VisibilitySelectorProps) => {
  const { value, onChange } = props;
  const compact = props.size === "compact";
  const t = useTranslate();
  const { selectedSpaceName } = useSpaceContext();

  const visibilityOptions = getAssignableVisibilityOptions({ spaceSelected: Boolean(selectedSpaceName), current: value });
  // Resolved from the full catalog, so the trigger names the memo's audience even
  // when that audience is not currently on offer.
  const currentOption = getVisibilityOption(value);

  return (
    <DropdownMenu onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              "inline-flex items-center rounded-md hover:bg-accent transition-colors",
              compact ? "px-1.5 py-[3px] text-[13px] leading-5 text-foreground/85" : "h-8 px-2 text-sm text-muted-foreground",
            )}
          />
        }
      >
        <VisibilityIcon visibility={value} className={cn("opacity-60 mr-1.5", compact && "w-[13px]")} />
        <span className="truncate">{currentOption ? t(currentOption.labelKey) : ""}</span>
        <ChevronDownIcon className={cn("ml-0.5 opacity-60", compact ? "size-3.5 text-muted-foreground/70" : "w-4 h-4")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {visibilityOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <VisibilityIcon visibility={option.value} />
            <div className="flex flex-col">
              <span>{t(option.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{t(option.descriptionKey)}</span>
            </div>
            {value === option.value && <CheckIcon className="ml-auto w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VisibilitySelector;
