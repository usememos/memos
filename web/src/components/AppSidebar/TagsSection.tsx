import { HashIcon, ListIcon, ListTreeIcon } from "lucide-react";
import { forwardRef, useMemo } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useLocalStorage, useOverflowTitle } from "@/hooks";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TagTree from "../TagTree";
import SidebarSectionHeader from "./SidebarSectionHeader";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
}

const TagPath = forwardRef<HTMLSpanElement, { tag: string }>(({ tag }, ref) => {
  const segments = tag.split("/");

  return (
    <span ref={ref} className="min-w-0 truncate text-left">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {index > 0 && <span className="px-0.5 text-muted-foreground/40">/</span>}
          <span className={index === segments.length - 1 ? "text-current" : "text-muted-foreground/75"}>{segment}</span>
        </span>
      ))}
    </span>
  );
});
TagPath.displayName = "TagPath";

interface FlatTagRowProps {
  tag: string;
  amount: number;
  active: boolean;
  onClick: () => void;
}

const FlatTagRow = ({ tag, amount, active, onClick }: FlatTagRowProps) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(`#${tag}`);

  return (
    <button
      type="button"
      aria-pressed={active || undefined}
      title={title}
      className={cn(
        "group grid h-[26px] w-full min-w-0 grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-[5px] px-2 text-xs leading-4 text-muted-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/40",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
      )}
      onClick={onClick}
    >
      <HashIcon aria-hidden="true" className="size-3 text-muted-foreground/65" strokeWidth={1.75} />
      <TagPath ref={ref} tag={tag} />
      <span className={cn("shrink-0 leading-none tabular-nums text-muted-foreground/50", active && "text-sidebar-accent-foreground/65")}>
        {amount}
      </span>
    </button>
  );
};

const TagsSection = ({ tagCount, onSelect }: Props) => {
  const t = useTranslate();
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const activeTags = new Set(getFiltersByFactor("tagSearch").map((filter) => filter.value));
  const activeTag = activeTags.values().next().value as string | undefined;
  const tags = useMemo(() => Object.entries(tagCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [tagCount]);

  if (tags.length === 0) {
    return null;
  }

  const handleTagClick = (tag: string) => {
    const active = activeTags.has(tag);
    if (active) {
      removeFilter((filter) => filter.factor === "tagSearch" && filter.value === tag);
    } else {
      removeFilter((filter) => filter.factor === "tagSearch");
      addFilter({ factor: "tagSearch", value: tag });
    }
    onSelect?.();
  };

  return (
    <section>
      <SidebarSectionHeader
        action={
          <div className="flex items-center gap-0.5" role="group" aria-label={t("common.tags")}>
            <button
              type="button"
              aria-label={t("common.tags")}
              aria-pressed={!treeMode}
              className={cn(
                "flex size-[22px] items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
                !treeMode && "bg-sidebar-accent text-foreground",
              )}
              onClick={() => setTreeMode(false)}
            >
              <ListIcon className="size-3.5" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              aria-label={`${t("common.tags")}: ${t("common.tree-mode")}`}
              aria-pressed={treeMode}
              className={cn(
                "flex size-[22px] items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
                treeMode && "bg-sidebar-accent text-foreground",
              )}
              onClick={() => setTreeMode(true)}
            >
              <ListTreeIcon className="size-3.5" strokeWidth={1.7} />
            </button>
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5 leading-none">
          {t("common.tags")}
          <span className="font-normal leading-none tracking-normal text-muted-foreground/45">{tags.length}</span>
        </span>
      </SidebarSectionHeader>
      {treeMode ? (
        <TagTree tagAmounts={tags} activeTag={activeTag} onTagClick={handleTagClick} />
      ) : (
        <div className="space-y-px">
          {tags.map(([tag, amount]) => (
            <FlatTagRow key={tag} tag={tag} amount={amount} active={activeTags.has(tag)} onClick={() => handleTagClick(tag)} />
          ))}
        </div>
      )}
    </section>
  );
};

export default TagsSection;
