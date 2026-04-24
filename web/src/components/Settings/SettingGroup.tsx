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
      {showSeparator && <Separator className="my-2" />}
      <div className={cn("flex flex-col gap-3", className)}>
        {(title || description || actions) && (
          <div className="flex items-start justify-between gap-3">
            {(title || description) && (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title && <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>}
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
              </div>
            )}
            {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
          </div>
        )}
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </>
  );
};

export default SettingGroup;
