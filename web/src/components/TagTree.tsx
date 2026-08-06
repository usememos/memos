import { HashIcon } from "lucide-react";
import { useMemo } from "react";
import {
  SIDEBAR_ROW_BOX_CLASSES,
  SIDEBAR_ROW_COUNT_CLASSES,
  SIDEBAR_ROW_FOCUS_CLASSES,
  SIDEBAR_ROW_ICON_CLASSES,
  sidebarRowStateClasses,
} from "@/components/AppSidebar/SidebarRow";
import { useOverflowTitle } from "@/hooks";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

/** Matches the memo outline's indent, the app's other nested rail list. */
const INDENT_STEP = 12;

interface TagTreeNode {
  key: string;
  text: string;
  amount?: number;
  subTags: TagTreeNode[];
}

interface Props {
  tagAmounts: [tag: string, amount: number][];
  activeTag?: string;
  onTagClick: (tag: string) => void;
}

export const buildTagTree = (tagAmounts: [tag: string, amount: number][]) => {
  const root: TagTreeNode = {
    key: "",
    text: "",
    subTags: [],
  };

  for (const [tag, amount] of [...tagAmounts].sort(([left], [right]) => left.localeCompare(right))) {
    const segments = tag.split("/");
    let parent = root;
    let path = "";

    segments.forEach((segment, index) => {
      path = path ? `${path}/${segment}` : segment;
      let node = parent.subTags.find((item) => item.key === segment);

      if (!node) {
        node = {
          key: segment,
          text: path,
          subTags: [],
        };
        parent.subTags.push(node);
      }

      if (index === segments.length - 1) {
        node.amount = amount;
      }
      parent = node;
    });
  }

  return root.subTags;
};

const TagMark = () => <HashIcon aria-hidden="true" className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />;

interface TagItemProps {
  tag: TagTreeNode;
  depth: number;
  activeTag?: string;
  onTagClick: (tag: string) => void;
}

const TagItem = ({ tag, depth, activeTag, onTagClick }: TagItemProps) => {
  const isTag = tag.amount !== undefined;
  const isActive = activeTag === tag.text;
  const isAncestorOfActiveTag = activeTag?.startsWith(`${tag.text}/`) ?? false;
  const hasSubTags = tag.subTags.length > 0;
  const { ref: labelRef, title } = useOverflowTitle<HTMLSpanElement>(isTag ? `#${tag.text}` : tag.text);

  return (
    <div className="w-full min-w-0">
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isActive || undefined}
        className={cn(
          SIDEBAR_ROW_BOX_CLASSES,
          isTag ? sidebarRowStateClasses(isActive) : "font-medium text-muted-foreground/65",
          isAncestorOfActiveTag && !isActive && "text-foreground/75",
        )}
        // Overrides the start half of the box's `px-2`, leaving the trailing 8px intact.
        // Same 12px step the memo outline indents by.
        style={{ paddingInlineStart: 8 + depth * INDENT_STEP }}
      >
        {isTag ? (
          <button
            type="button"
            aria-pressed={isActive || undefined}
            title={title}
            className={cn("flex h-full min-w-0 flex-1 items-center gap-2 text-left", SIDEBAR_ROW_FOCUS_CLASSES)}
            onClick={() => onTagClick(tag.text)}
          >
            <TagMark />
            <span ref={labelRef} className="min-w-0 flex-1 truncate">
              {tag.key}
            </span>
            <span className={SIDEBAR_ROW_COUNT_CLASSES}>{tag.amount}</span>
          </button>
        ) : (
          // Aligns with the tag rows below it: past the 15px mark plus the row's 8px gap.
          <span ref={labelRef} className="min-w-0 flex-1 truncate ps-[23px]" title={title}>
            {tag.key}
          </span>
        )}
      </div>

      {hasSubTags && (
        <div className="mt-0.5 flex w-full min-w-0 flex-col gap-0.5" role="group">
          {tag.subTags.map((subTag) => (
            <TagItem key={subTag.text} tag={subTag} depth={depth + 1} activeTag={activeTag} onTagClick={onTagClick} />
          ))}
        </div>
      )}
    </div>
  );
};

const TagTree = ({ tagAmounts, activeTag, onTagClick }: Props) => {
  const t = useTranslate();
  const tags = useMemo(() => buildTagTree(tagAmounts), [tagAmounts]);

  return (
    <div className="relative flex h-auto w-full flex-col items-stretch gap-0.5" role="tree" aria-label={t("common.tags")}>
      {tags.map((tag) => (
        <TagItem key={tag.text} tag={tag} depth={0} activeTag={activeTag} onTagClick={onTagClick} />
      ))}
    </div>
  );
};

export default TagTree;
