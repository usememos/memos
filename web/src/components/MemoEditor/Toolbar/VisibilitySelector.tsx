import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import type { VisibilitySelectorProps } from "../types";

/**
 * The visibility control is a quiet 28px chip built like the sidebar's scope pill: a
 * 16px glyph at 75%, a 13px label and a 12px chevron at 55%. It fills only while its
 * menu is open.
 */
const VisibilitySelector = (props: VisibilitySelectorProps) => {
  const { value, onChange } = props;
  const t = useTranslate();

  const visibilityOptions = getAssignableVisibilityOptions({ hasSpacePlacement: Boolean(props.space), current: value });
  // Resolved from the full catalog, so the trigger names the memo's audience even
  // when that audience is not currently on offer.
  const currentOption = getVisibilityOption(value);

  return (
    <DropdownMenu onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger render={<Button variant="quiet" size="sm" />}>
        <VisibilityIcon visibility={value} className="text-current opacity-75" />
        <span className="truncate">{currentOption ? t(currentOption.labelKey) : ""}</span>
        <ChevronDownIcon className="size-3 opacity-55" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" size="sm">
        {visibilityOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <VisibilityIcon visibility={option.value} className="size-3.5" />
            <div className="flex flex-col">
              <span>{t(option.labelKey)}</span>
              <span className="text-2xs text-muted-foreground">{t(option.descriptionKey)}</span>
            </div>
            <CheckIcon className={cn("ms-auto size-3.5 text-primary", value !== option.value && "invisible")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VisibilitySelector;
