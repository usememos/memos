import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count: number;
  tabs?: Array<{
    id: string;
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
  }>;
}

const SectionHeader = ({ icon: Icon, title, count, tabs }: SectionHeaderProps) => {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-muted/30">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />

      {tabs && tabs.length > 1 ? (
        <div className="flex items-center gap-0.5">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="flex items-center gap-0.5">
              <button
                onClick={tab.onClick}
                className={cn(
                  "text-xs px-0 py-0 transition-colors",
                  tab.active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label} ({tab.count})
              </button>
              {idx < tabs.length - 1 && <span className="text-muted-foreground/40 font-mono text-xs">/</span>}
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-foreground">
          {title} ({count})
        </span>
      )}
    </div>
  );
};

export default SectionHeader;
