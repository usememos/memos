import { HashIcon, ListIcon, ListTreeIcon } from "lucide-react";
import { forwardRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { replaceFiltersByFactor, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useLocalStorage, useOverflowTitle } from "@/hooks";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TagTree from "../TagTree";
import { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_COUNT_CLASSES, SIDEBAR_ROW_ICON_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, {
  SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES,
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_ACTION_ICON_CLASSES,
} from "./SidebarSection";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
  /** When set, tag clicks land on this route with the tag filter instead of filtering the current one. */
  navigationTarget?: string;
  /** Whose tags these are; keeps tree expansion state from bleeding between users and views. */
  scope: string;
}

const TagPath = forwardRef<HTMLSpanElement, { tag: string }>(({ tag }, ref) => {
  const segments = tag.split("/");

  return (
    <span ref={ref} className="min-w-0 flex-1 truncate text-left">
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
      className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(active))}
      onClick={onClick}
    >
      <HashIcon aria-hidden="true" className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
      <TagPath ref={ref} tag={tag} />
      <span className={SIDEBAR_ROW_COUNT_CLASSES}>{amount}</span>
    </button>
  );
};

const TagsSection = ({ tagCount, onSelect, navigationTarget, scope }: Props) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { filters, setFilters, getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const activeTags = new Set(getFiltersByFactor("tagSearch").map((filter) => filter.value));
  const activeTag = activeTags.values().next().value as string | undefined;
  const tags = useMemo(() => Object.entries(tagCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [tagCount]);

  if (tags.length === 0) {
    return null;
  }

  const handleTagClick = (tag: string) => {
    if (navigationTarget) {
      const nextFilters = replaceFiltersByFactor(filters, "tagSearch", [{ factor: "tagSearch", value: tag }]);
      setFilters(nextFilters);
      navigate({ pathname: navigationTarget, search: `?filter=${stringifyFilters(nextFilters)}` });
      onSelect?.();
      return;
    }
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
    <SidebarSection
      label={t("common.tags")}
      action={
        <div className="flex items-center gap-0.5" role="group" aria-label={t("common.tags")}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${t("common.tags")}: ${t("memo.layout-list")}`}
            aria-pressed={!treeMode}
            className={cn(SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, !treeMode && SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES)}
            onClick={() => setTreeMode(false)}
          >
            <ListIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${t("common.tags")}: ${t("common.tree-mode")}`}
            aria-pressed={treeMode}
            className={cn(SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, treeMode && SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES)}
            onClick={() => setTreeMode(true)}
          >
            <ListTreeIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
          </Button>
        </div>
      }
    >
      {treeMode ? (
        <TagTree key={scope} tagAmounts={tags} activeTag={activeTag} scope={scope} onTagClick={handleTagClick} />
      ) : (
        <>
          {tags.map(([tag, amount]) => (
            <FlatTagRow key={tag} tag={tag} amount={amount} active={activeTags.has(tag)} onClick={() => handleTagClick(tag)} />
          ))}
        </>
      )}
    </SidebarSection>
  );
};

export default TagsSection;
