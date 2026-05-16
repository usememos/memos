import { type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SettingListProps {
  children: ReactNode;
  className?: string;
}

export const SettingList = ({ children, className }: SettingListProps) => {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background divide-y divide-border", className)}>{children}</div>
  );
};

interface SettingListItemProps {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
  contentClassName?: string;
  controlClassName?: string;
  vertical?: boolean;
}

export const SettingListItem = ({
  label,
  description,
  children,
  icon,
  className,
  contentClassName,
  controlClassName,
  vertical = false,
}: SettingListItemProps) => {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 px-3 py-3", !vertical && "sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className={cn("flex min-w-0 gap-2", contentClassName)}>
        {icon && <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>}
        </div>
      </div>
      {children && <div className={cn("flex min-w-0 items-center", !vertical && "sm:shrink-0", controlClassName)}>{children}</div>}
    </div>
  );
};

interface SettingPanelProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export const SettingPanel = ({ children, className, header, footer }: SettingPanelProps) => {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      {header && <div className="border-b border-border px-3 py-2">{header}</div>}
      {children}
      {footer && <div className="border-t border-border bg-muted/20 px-3 py-2">{footer}</div>}
    </div>
  );
};

interface SettingCodeEditorProps {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export const SettingCodeEditor = ({ label, description, value, placeholder, onChange }: SettingCodeEditorProps) => {
  return (
    <SettingPanel
      header={
        <>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </>
      }
    >
      <Textarea
        className="min-h-24 rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
        rows={4}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </SettingPanel>
  );
};
