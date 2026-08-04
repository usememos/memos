import { HashIcon, MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useLocalStorage } from "@/hooks";
import { useTranslate } from "@/utils/i18n";
import TagTree from "../TagTree";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import SidebarRow from "./SidebarRow";
import SidebarSectionHeader from "./SidebarSectionHeader";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
}

const TagsSection = ({ tagCount, onSelect }: Props) => {
  const t = useTranslate();
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const [treeAutoExpand, setTreeAutoExpand] = useLocalStorage<boolean>("tag-tree-auto-expand", false);
  const activeTags = new Set(getFiltersByFactor("tagSearch").map((filter) => filter.value));
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
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                  aria-label={t("common.settings")}
                />
              }
            >
              <MoreHorizontalIcon className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="end" alignOffset={-12} className="w-48">
              <div className="flex items-center justify-between gap-2 p-1">
                <span className="text-sm">{t("common.tree-mode")}</span>
                <Switch checked={treeMode} onCheckedChange={setTreeMode} />
              </div>
              <div className="flex items-center justify-between gap-2 p-1">
                <span className="text-sm">{t("common.auto-expand")}</span>
                <Switch disabled={!treeMode} checked={treeAutoExpand} onCheckedChange={setTreeAutoExpand} />
              </div>
            </PopoverContent>
          </Popover>
        }
      >
        {t("common.tags")}
      </SidebarSectionHeader>
      {treeMode ? (
        <TagTree tagAmounts={tags} expandSubTags={!!treeAutoExpand} />
      ) : (
        <div className="space-y-0.5">
          {tags.map(([tag, amount]) => {
            const active = activeTags.has(tag);
            return <SidebarRow key={tag} active={active} icon={HashIcon} label={tag} count={amount} onClick={() => handleTagClick(tag)} />;
          })}
        </div>
      )}
    </section>
  );
};

export default TagsSection;
