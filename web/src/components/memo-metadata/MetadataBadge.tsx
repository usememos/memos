import { XIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetadataBadgeProps {
  icon: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  maxWidth?: string;
}

/**
 * Shared badge component for metadata display (Location, Tags, etc.)
 * Provides consistent styling across editor and view modes
 */
const MetadataBadge = ({ icon, children, onRemove, onClick, className, maxWidth = "max-w-[160px]" }: MetadataBadgeProps) => {
  return (
    <div
      className={cn(
        "group relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors",
        onClick && "cursor-pointer hover:bg-accent",
        className,
      )}
      onClick={onClick}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className={cn("truncate", maxWidth)}>{children}</span>
      {onRemove && (
        <button
          className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
};

export default MetadataBadge;
