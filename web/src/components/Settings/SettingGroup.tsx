import React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SettingGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showSeparator?: boolean;
  actions?: React.ReactNode;
}

const SettingGroup: React.FC<SettingGroupProps> = ({ title, description, children, className, showSeparator = false, actions }) => {
  return (
    <>
      {showSeparator && <Separator className="my-0" />}
      <div className={cn("flex min-w-0 flex-col gap-3", className)}>
        {(title || description || actions) && (
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {(title || description) && (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}
                {description && <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>}
              </div>
            )}
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">{actions}</div> : null}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </div>
    </>
  );
};

export default SettingGroup;
