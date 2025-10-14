import { cloneElement, isValidElement } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StatCardProps } from "@/types/statistics";

export const StatCard = ({ icon, label, count, onClick, tooltip, className }: StatCardProps) => {
  const iconNode = isValidElement(icon)
    ? cloneElement(icon, {
        className: cn("h-3.5 w-3.5", icon.props.className),
      })
    : icon;

  const countNode = (() => {
    if (typeof count === "number" || typeof count === "string") {
      return <span className="text-foreground/80">{count}</span>;
    }
    if (isValidElement(count)) {
      return cloneElement(count, {
        className: cn("text-foreground/80", count.props.className),
      });
    }
    return <span className="text-foreground/80">{count}</span>;
  })();

  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/80 px-1 pr-2 py-0.5 text-sm leading-none text-muted-foreground transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center text-muted-foreground/80">{iconNode}</span>
      <span className="truncate text-sm text-foreground/70">{label}</span>
      <span className="ml-1 flex items-center text-sm">{countNode}</span>
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
