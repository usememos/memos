import React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SettingGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showSeparator?: boolean;
}

const SettingGroup: React.FC<SettingGroupProps> = ({ title, description, children, className, showSeparator = false }) => {
  return (
    <>
      {showSeparator && <Separator className="my-2" />}
      <div className={cn("flex flex-col gap-3", className)}>
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </>
  );
};

export default SettingGroup;
