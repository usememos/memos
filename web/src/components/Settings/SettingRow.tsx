import { HelpCircleIcon } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description?: string;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
  vertical?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, tooltip, children, className, vertical = false }) => {
  return (
    <div className={cn("w-full flex gap-3", vertical ? "flex-col" : "flex-row justify-between items-center", className)}>
      <div className={cn("flex flex-col gap-1", vertical ? "w-full" : "flex-1 min-w-0")}>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm", vertical ? "font-medium" : "")}>{label}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircleIcon className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("flex items-center", vertical ? "w-full" : "shrink-0")}>{children}</div>
    </div>
  );
};

export default SettingRow;
