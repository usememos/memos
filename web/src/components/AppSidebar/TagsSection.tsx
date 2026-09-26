import { ListTreeIcon, MoreHorizontalIcon } from "lucide-react";
import { forwardRef, useMemo } from "react";
import TagIconPicker from "@/components/TagIconPicker";
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
import type { CustomIconValue } from "@/lib/custom-icons";
import { extractTagEmoji } from "@/lib/tag";
import { cn } from "@/lib/utils";
import type { UserSetting_TagMetadata_Icon } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import TagTree, { tagRowAriaLabel } from "../TagTree";
import {
  SIDEBAR_ROW_BOX_CLASSES,
  SIDEBAR_ROW_CLASSES,
  SIDEBAR_ROW_COUNT_RAIL_CLASSES,
  SIDEBAR_ROW_LABEL_CLASSES,
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  SidebarRowTagMark,
  SidebarRowTagMarkSlot,
  sidebarRowStateAttributes,
  sidebarRowStateClasses,
} from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "./SidebarSection";

interface Props {
  tagCount: Record<string, number>;
  onSelect?: () => void;
  /** Whose tags these are; keeps tree expansion state from bleeding between users and views. */
  scope: string;
  /** Resolves a tag's mark. Supplied by the shell, which holds the tag settings. */
  tagIcon?: (tag: string) => CustomIconValue | undefined;
  /** Omitted when nobody is signed in to own the preference, which makes the marks read-only. */
  onTagIconChange?: (tag: string, icon: UserSetting_TagMetadata_Icon | undefined) => void;
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
  icon?: CustomIconValue;
  onClick: () => void;
  onIconChange?: (icon: UserSetting_TagMetadata_Icon | undefined) => void;
}

const FlatTagRow = ({ tag, amount, active, ariaLabel, icon, onClick, onIconChange }: FlatTagRowProps) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(`#${tag}`);
  const { text } = extractTagEmoji(tag);
  const state = active ? "checked" : "idle";
  const label = (
    <>
      <TagPath ref={ref} tag={text} />
      <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{amount}</span>
    </>
  );

  // Read-only lists keep the single-control row; owning the tags turns the mark into the
  // picker, so an icon is one click from the tag itself rather than a trip to settings.
  if (!onIconChange) {
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
        <SidebarRowTagMarkSlot icon={icon} />
        {label}
      </button>
    );
  }

  return (
    <div {...sidebarRowStateAttributes(state)} className={cn(SIDEBAR_ROW_BOX_CLASSES, sidebarRowStateClasses(state))}>
      <TagIconPicker
        tag={tag}
        value={icon}
        onChange={onIconChange}
        trigger={<button type="button" className={SIDEBAR_ROW_SLOT_BUTTON_CLASSES} />}
        triggerContent={<SidebarRowTagMark icon={icon} />}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={active || undefined}
        title={title}
        className={SIDEBAR_ROW_LABEL_CLASSES}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
};

const TagsSection = ({ tagCount, onSelect, scope, tagIcon, onTagIconChange }: Props) => {
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
                render={<Button variant="quiet" size="icon-sm" />}
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
        <TagTree key={scope} tagAmounts={tags} activeTag={activeTag} scope={scope} tagIcon={tagIcon} onTagClick={handleTagClick} />
      ) : (
        <>
          {tags.map(([tag, amount]) => (
            <FlatTagRow
              key={tag}
              tag={tag}
              amount={amount}
              active={activeTags.has(tag)}
              ariaLabel={tagRowAriaLabel(t, tag, amount)}
              icon={tagIcon?.(tag)}
              onClick={() => handleTagClick(tag)}
              onIconChange={onTagIconChange && ((icon) => onTagIconChange(tag, icon))}
            />
          ))}
        </>
      )}
    </SidebarSection>
  );
};

export default TagsSection;
