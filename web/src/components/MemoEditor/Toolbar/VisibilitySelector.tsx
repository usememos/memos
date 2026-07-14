import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import type { VisibilitySelectorProps } from "../types";

const VisibilitySelector = (props: VisibilitySelectorProps) => {
  const { value, onChange } = props;
  const t = useTranslate();

  const visibilityOptions = [
    { value: Visibility.PRIVATE, label: t("memo.visibility.private"), description: t("memo.visibility.private-description") },
    { value: Visibility.PROTECTED, label: t("memo.visibility.protected"), description: t("memo.visibility.protected-description") },
    { value: Visibility.PUBLIC, label: t("memo.visibility.public"), description: t("memo.visibility.public-description") },
  ] as const;

  const currentLabel = visibilityOptions.find((option) => option.value === value)?.label || "";

  return (
    <DropdownMenu onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button className="inline-flex items-center h-8 px-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors" />
        }
      >
        <VisibilityIcon visibility={value} className="opacity-60 mr-1.5" />
        <span>{currentLabel}</span>
        <ChevronDownIcon className="ml-0.5 w-4 h-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {visibilityOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <VisibilityIcon visibility={option.value} />
            <div className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
            {value === option.value && <CheckIcon className="ml-auto w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VisibilitySelector;
