import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SectionHeaderTab {
  id: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count: number;
  tabs?: SectionHeaderTab[];
}

const SectionHeader = ({ icon: Icon, title, count, tabs }: SectionHeaderProps) => {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-muted/30">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />

      {tabs && tabs.length > 1 ? (
        <div className="flex items-center gap-0.5">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={tab.onClick}
                className={cn(
                  "h-auto text-xs px-0 py-0 hover:bg-transparent",
                  tab.active ? "text-muted-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
                )}
              >
                {tab.label} ({tab.count})
              </Button>
              {idx < tabs.length - 1 && <span className="text-muted-foreground/40 font-mono text-xs">/</span>}
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          {title} ({count})
        </span>
      )}
    </div>
  );
};

export default SectionHeader;
