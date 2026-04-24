import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  tooltip?: string;
  className?: string;
}

const InfoChip = ({ label, value, tooltip, className }: Props) => {
  const chip = (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full items-start gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-normal leading-4 whitespace-nowrap",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[20rem] truncate text-foreground">{value}</span>
    </Badge>
  );

  if (!tooltip) {
    return chip;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0} aria-label={tooltip}>
          {chip}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">{tooltip}</TooltipContent>
    </Tooltip>
  );
};

export default InfoChip;
