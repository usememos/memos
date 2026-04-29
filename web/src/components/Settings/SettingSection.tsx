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
    <div className={cn("mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5 py-1 sm:py-2", className)}>
      {(title || description || actions) && (
        <div className="flex min-w-0 flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            {title && (
              <div className="mb-1 text-lg font-semibold tracking-tight text-foreground">
                {typeof title === "string" ? <h3>{title}</h3> : title}
              </div>
            )}
            {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  );
};

export default SettingSection;
