import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StatCardProps } from "@/types/statistics";

export const StatCard = ({ icon, label, count, onClick, tooltip, className }: StatCardProps) => {
  const content = (
    <div
      className={cn(
        "w-auto border pl-1.5 pr-2 py-0.5 rounded-md flex justify-between items-center",
        "cursor-pointer hover:bg-muted transition-colors",
        className,
      )}
      onClick={onClick}
    >
      <div className="w-auto flex justify-start items-center mr-1">
        {icon}
        <span className="block text-sm opacity-80">{label}</span>
      </div>
      <span className="text-sm truncate opacity-80">{count}</span>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};
