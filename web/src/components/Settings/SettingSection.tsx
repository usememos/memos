import React from "react";
import { cn } from "@/lib/utils";

interface SettingSectionProps {
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, description, children, className, actions }) => {
  return (
    <div className={cn("w-full flex flex-col gap-4 pt-2 pb-4", className)}>
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex-1">
            {title && (
              <div className="text-base font-semibold text-foreground mb-1">{typeof title === "string" ? <h3>{title}</h3> : title}</div>
            )}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
};

export default SettingSection;
