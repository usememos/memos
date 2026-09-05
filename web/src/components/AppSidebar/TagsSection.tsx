import { HashIcon, ListTreeIcon, MoreHorizontalIcon } from "lucide-react";
import { forwardRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useLocalStorage, useOverflowTitle } from "@/hooks";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TagTree, { tagRowAriaLabel } from "../TagTree";
import {
  SIDEBAR_ROW_CLASSES,
  SIDEBAR_ROW_COUNT_RAIL_CLASSES,
  SidebarRowIconSlot,
  sidebarRowStateAttributes,
  sidebarRowStateClasses,
} from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "./SidebarSection";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
  /** Whose tags these are; keeps tree expansion state from bleeding between users and views. */
  scope: string;
}

const TagPath = forwardRef<HTMLSpanElement, { tag: string }>(({ tag }, ref) => {
  const segments = tag.split("/");

  return (
    <span ref={ref} className="min-w-0 flex-1 truncate text-start">
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
  /** Computed by the parent, which already holds the translator — rows stay subscription-free. */
  ariaLabel: string;
  onClick: () => void;
}

const FlatTagRow = ({ tag, amount, active, ariaLabel, onClick }: FlatTagRowProps) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(`#${tag}`);
  const state = active ? "checked" : "idle";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      title={title}
      {...sidebarRowStateAttributes(state)}
      className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(state))}
      onClick={onClick}
    >
      {/* Same leading slot as the tree, so the # marks hold their line when switching modes. */}
      <SidebarRowIconSlot icon={HashIcon} />
      <TagPath ref={ref} tag={tag} />
      <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{amount}</span>
    </button>
  );
};

const TagsSection = ({ tagCount, onSelect, scope }: Props) => {
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
    <SidebarSection
      label={t("common.tags")}
      action={
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <DropdownMenuTrigger
                aria-label={`${t("common.tags")}: ${t("common.more")}`}
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
                      "data-popup-open:bg-sidebar-accent data-popup-open:text-foreground",
                    )}
                  />
                }
              >
                <MoreHorizontalIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{t("common.more")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" sideOffset={4} size="sm" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground">{t("common.tags")}</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={treeMode}
                onCheckedChange={setTreeMode}
                closeOnClick
                className="ps-2 pe-7 [&>span]:start-auto [&>span]:end-2"
              >
                <ListTreeIcon className="text-muted-foreground" strokeWidth={1.8} />
                {t("common.tree-mode")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {treeMode ? (
        <TagTree key={scope} tagAmounts={tags} activeTag={activeTag} scope={scope} onTagClick={handleTagClick} />
      ) : (
        <>
          {tags.map(([tag, amount]) => (
            <FlatTagRow
              key={tag}
              tag={tag}
              amount={amount}
              active={activeTags.has(tag)}
              ariaLabel={tagRowAriaLabel(t, tag, amount)}
              onClick={() => handleTagClick(tag)}
            />
          ))}
        </>
      )}
    </SidebarSection>
  );
};

export default TagsSection;
