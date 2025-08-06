import VisibilityIcon from "@/components/VisibilityIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

// ⬅️ ADD this line

interface Props {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  onOpenChange?: (open: boolean) => void;
}

const VisibilitySelector = (props: Props) => {
  const { value, onChange } = props;
  const t = useTranslate();

  const visibilityOptions = [
    { value: Visibility.PRIVATE, label: t("memo.visibility.private") },
    { value: Visibility.PROTECTED, label: t("memo.visibility.protected") },
    { value: Visibility.PUBLIC, label: t("memo.visibility.public") },
  ];

  const handleOpenChange = (open: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(open);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Select value={value.toString()} onValueChange={onChange} onOpenChange={handleOpenChange}>
            <SelectTrigger size="xs" className="!bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {visibilityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  <VisibilityIcon className="size-3.5" visibility={option.value} />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("tooltip.select-visibility")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VisibilitySelector;
