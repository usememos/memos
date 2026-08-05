import { ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface TagTreeNode {
  key: string;
  text: string;
  amount?: number;
  subTags: TagTreeNode[];
}

interface Props {
  tagAmounts: [tag: string, amount: number][];
  activeTag?: string;
  expandedTagPaths: ReadonlySet<string>;
  onTagClick: (tag: string) => void;
  onToggleBranch: (tag: string) => void;
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

const TagMark = () => (
  <span aria-hidden="true" className="w-3 shrink-0 text-center font-mono text-[11px] font-medium text-muted-foreground/70">
    #
  </span>
);

interface TagItemProps {
  tag: TagTreeNode;
  depth: number;
  activeTag?: string;
  expandedTagPaths: ReadonlySet<string>;
  onTagClick: (tag: string) => void;
  onToggleBranch: (tag: string) => void;
}

const TagItem = ({ tag, depth, activeTag, expandedTagPaths, onTagClick, onToggleBranch }: TagItemProps) => {
  const t = useTranslate();
  const isTag = tag.amount !== undefined;
  const isActive = activeTag === tag.text;
  const isAncestorOfActiveTag = activeTag?.startsWith(`${tag.text}/`) ?? false;
  const hasSubTags = tag.subTags.length > 0;
  const showSubTags = expandedTagPaths.has(tag.text);

  return (
    <div className="w-full min-w-0">
      <div
        role="treeitem"
        aria-expanded={hasSubTags ? showSubTags : undefined}
        aria-selected={isActive || undefined}
        className={cn(
          "relative flex h-7 w-full min-w-0 items-center rounded-[5px] pr-2 text-[13px] leading-[18px] text-muted-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
          isAncestorOfActiveTag && !isActive && "text-foreground/75",
          !isTag && "text-[12.5px] text-muted-foreground/75",
        )}
        style={{ paddingInlineStart: 4 + depth * 14 }}
      >
        {hasSubTags ? (
          <button
            type="button"
            aria-label={`${showSubTags ? t("common.collapse") : t("common.expand")} ${tag.key}`}
            aria-expanded={showSubTags}
            className="mr-0.5 flex size-5 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground/75 transition-colors hover:bg-background/70 hover:text-foreground focus-visible:bg-background/70 focus-visible:text-foreground focus-visible:outline-none"
            onClick={() => onToggleBranch(tag.text)}
          >
            <ChevronRightIcon className={cn("size-3 transition-transform duration-150", showSubTags && "rotate-90")} strokeWidth={1.8} />
          </button>
        ) : (
          <span className="mr-0.5 size-5 shrink-0" />
        )}

        {isTag ? (
          <button
            type="button"
            aria-pressed={isActive || undefined}
            title={`#${tag.text}`}
            className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left focus-visible:text-foreground focus-visible:underline focus-visible:decoration-muted-foreground focus-visible:underline-offset-2 focus-visible:outline-none"
            onClick={() => onTagClick(tag.text)}
          >
            <TagMark />
            <span className="min-w-0 flex-1 truncate">{tag.key}</span>
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate" title={tag.text}>
            {tag.key}
          </span>
        )}

        {isTag && (
          <span
            className={cn(
              "ml-1.5 shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground/55",
              isActive && "text-sidebar-accent-foreground/65",
            )}
          >
            {tag.amount}
          </span>
        )}
      </div>

      {hasSubTags && showSubTags && (
        <div className="w-full min-w-0" role="group">
          {tag.subTags.map((subTag) => (
            <TagItem
              key={subTag.text}
              tag={subTag}
              depth={depth + 1}
              activeTag={activeTag}
              expandedTagPaths={expandedTagPaths}
              onTagClick={onTagClick}
              onToggleBranch={onToggleBranch}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TagTree = ({ tagAmounts, activeTag, expandedTagPaths, onTagClick, onToggleBranch }: Props) => {
  const t = useTranslate();
  const tags = useMemo(() => buildTagTree(tagAmounts), [tagAmounts]);

  return (
    <div className="relative flex h-auto w-full flex-col items-stretch gap-px" role="tree" aria-label={t("common.tags")}>
      {tags.map((tag) => (
        <TagItem
          key={tag.text}
          tag={tag}
          depth={0}
          activeTag={activeTag}
          expandedTagPaths={expandedTagPaths}
          onTagClick={onTagClick}
          onToggleBranch={onToggleBranch}
        />
      ))}
    </div>
  );
};

export default TagTree;
