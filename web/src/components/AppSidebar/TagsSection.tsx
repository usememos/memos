import { ListIcon, ListTreeIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useLocalStorage } from "@/hooks";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TagTree from "../TagTree";
import SidebarSectionHeader from "./SidebarSectionHeader";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
}

const TagPath = ({ tag }: { tag: string }) => {
  const segments = tag.split("/");

  return (
    <span className="min-w-0 truncate text-left">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {index > 0 && <span className="px-0.5 font-mono text-[10.5px] text-muted-foreground/45">/</span>}
          <span className={index === segments.length - 1 ? "text-current" : "text-muted-foreground/75"}>{segment}</span>
        </span>
      ))}
    </span>
  );
};

const getExpandableTagPaths = (tags: [tag: string, amount: number][]) => {
  const paths = new Set<string>();

  for (const [tag] of tags) {
    const segments = tag.split("/");
    for (let index = 1; index < segments.length; index++) {
      paths.add(segments.slice(0, index).join("/"));
    }
  }

  return paths;
};

const getParentTagPaths = (tag: string) => {
  const segments = tag.split("/");
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
};

const TagsSection = ({ tagCount, onSelect }: Props) => {
  const t = useTranslate();
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const [expandedTagPaths, setExpandedTagPaths] = useState<Set<string>>(() => new Set());
  const activeTags = new Set(getFiltersByFactor("tagSearch").map((filter) => filter.value));
  const activeTag = activeTags.values().next().value as string | undefined;
  const tags = useMemo(() => Object.entries(tagCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [tagCount]);
  const expandableTagPaths = useMemo(() => getExpandableTagPaths(tags), [tags]);

  useEffect(() => {
    setExpandedTagPaths((current) => {
      const next = new Set(Array.from(current).filter((path) => expandableTagPaths.has(path)));
      return next.size === current.size ? current : next;
    });
  }, [expandableTagPaths]);

  useEffect(() => {
    if (!treeMode || !activeTag) {
      return;
    }

    setExpandedTagPaths((current) => {
      const next = new Set([...current, ...getParentTagPaths(activeTag)]);
      return next.size === current.size ? current : next;
    });
  }, [activeTag, treeMode]);

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

  const handleToggleBranch = (tag: string) => {
    setExpandedTagPaths((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  return (
    <section>
      <SidebarSectionHeader
        action={
          <div className="flex gap-px" role="group" aria-label={t("common.tags")}>
            <button
              type="button"
              aria-label={t("common.tags")}
              aria-pressed={!treeMode}
              className={cn(
                "flex size-5 items-center justify-center rounded-[4px] text-muted-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:bg-sidebar-accent focus-visible:text-foreground",
                !treeMode && "bg-sidebar-accent text-foreground",
              )}
              onClick={() => setTreeMode(false)}
            >
              <ListIcon className="size-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              aria-label={`${t("common.tags")}: ${t("common.tree-mode")}`}
              aria-pressed={treeMode}
              className={cn(
                "flex size-5 items-center justify-center rounded-[4px] text-muted-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:bg-sidebar-accent focus-visible:text-foreground",
                treeMode && "bg-sidebar-accent text-foreground",
              )}
              onClick={() => setTreeMode(true)}
            >
              <ListTreeIcon className="size-3" strokeWidth={1.8} />
            </button>
          </div>
        }
      >
        <span className="inline-flex items-baseline gap-1.5">
          {t("common.tags")}
          <span className="font-mono text-[9px] font-normal tracking-normal text-muted-foreground/45">{tags.length}</span>
        </span>
      </SidebarSectionHeader>
      {treeMode ? (
        <TagTree
          tagAmounts={tags}
          activeTag={activeTag}
          expandedTagPaths={expandedTagPaths}
          onTagClick={handleTagClick}
          onToggleBranch={handleToggleBranch}
        />
      ) : (
        <div className="space-y-px">
          {tags.map(([tag, amount]) => {
            const active = activeTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active || undefined}
                title={`#${tag}`}
                className={cn(
                  "group flex h-7 w-full min-w-0 items-center gap-1.5 rounded-[5px] px-2 text-[13px] leading-[18px] text-muted-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/40",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                )}
                onClick={() => handleTagClick(tag)}
              >
                <span aria-hidden="true" className="w-3 shrink-0 text-center font-mono text-[11px] font-medium text-muted-foreground/70">
                  #
                </span>
                <TagPath tag={tag} />
                <span
                  className={cn(
                    "ml-auto shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground/55",
                    active && "text-sidebar-accent-foreground/65",
                  )}
                >
                  {amount}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TagsSection;
