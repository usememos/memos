import { ChevronRightIcon, HashIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  SIDEBAR_ROW_BOX_CLASSES,
  SIDEBAR_ROW_COUNT_RAIL_CLASSES,
  SIDEBAR_ROW_ICON_CLASSES,
  SIDEBAR_ROW_LABEL_CLASSES,
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  SIDEBAR_ROW_SLOT_CLASSES,
  SidebarRowIconSlot,
  sidebarRowStateAttributes,
  sidebarRowStateClasses,
} from "@/components/AppSidebar/SidebarRow";
import { useLocalStorage, useOverflowTitle } from "@/hooks";
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
  /** Identifies whose tags these are, so expansion persists per tenant rather than per browser. */
  scope: string;
  onTagClick: (tag: string) => void;
}

/** Persisted per scope: which branches are open, and the selection already revealed. */
interface TagTreeExpansion {
  expanded: string[];
  revealedFor?: string;
}

const EMPTY_EXPANSION: TagTreeExpansion = { expanded: [] };

// A structural row toggles like any other, so it hovers like one too — just quieter at rest.
const STRUCTURAL_ROW_CLASSES = cn(sidebarRowStateClasses(), "font-medium text-muted-foreground/65");

/** One announcement for a tag row in either layout, so tree and flat mode never drift apart. */
export const tagRowAriaLabel = (t: ReturnType<typeof useTranslate>, tag: string, amount: number) =>
  `#${tag}, ${t("setting.tags.used-count", { count: amount })}`;

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

const parentPathsOf = (tag: string): string[] => {
  const segments = tag.split("/");
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
};

const TagMark = ({ className }: { className?: string }) => (
  <HashIcon aria-hidden="true" className={cn(SIDEBAR_ROW_ICON_CLASSES, className)} strokeWidth={1.8} />
);

const Chevron = ({ open, className }: { open: boolean; className?: string }) => (
  <ChevronRightIcon
    aria-hidden="true"
    className={cn(
      "me-auto size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
      open ? "rotate-90" : "rtl:rotate-180",
      className,
    )}
    strokeWidth={1.8}
  />
);

interface TagItemProps {
  tag: TagTreeNode;
  depth: number;
  activeTag?: string;
  expanded: ReadonlySet<string>;
  onTagClick: (tag: string) => void;
  onToggle: (path: string) => void;
}

const TagItem = ({ tag, depth, activeTag, expanded, onTagClick, onToggle }: TagItemProps) => {
  const t = useTranslate();
  const isTag = tag.amount !== undefined;
  const isActive = activeTag === tag.text;
  const isAncestorOfActiveTag = activeTag?.startsWith(`${tag.text}/`) ?? false;
  const hasSubTags = tag.subTags.length > 0;
  const open = hasSubTags && expanded.has(tag.text);
  const { ref: labelRef, title } = useOverflowTitle<HTMLSpanElement>(isTag ? `#${tag.text}` : tag.text);
  const tagLabel = tag.amount !== undefined ? tagRowAriaLabel(t, tag.text, tag.amount) : undefined;
  const state = isActive ? "checked" : "idle";

  return (
    <div className="w-full min-w-0">
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isActive || undefined}
        aria-expanded={hasSubTags ? open : undefined}
        {...sidebarRowStateAttributes(state)}
        className={cn(
          SIDEBAR_ROW_BOX_CLASSES,
          isTag ? sidebarRowStateClasses(state) : STRUCTURAL_ROW_CLASSES,
          isAncestorOfActiveTag && !isActive && "text-foreground/75",
        )}
        // Overrides the start half of the box's `px-2`, leaving the trailing 8px intact.
        // Same 12px step the memo outline indents by.
        style={{ paddingInlineStart: 8 + depth * INDENT_STEP }}
      >
        {isTag && hasSubTags && (
          // At rest the slot holds the row's # mark like any other tag; pointing at the row
          // (or tabbing into it) swaps in the chevron, so branches only look different while
          // the disclosure is actually reachable.
          <button
            type="button"
            aria-label={`${open ? t("common.collapse") : t("common.expand")} #${tag.text}`}
            aria-expanded={open}
            className={SIDEBAR_ROW_SLOT_BUTTON_CLASSES}
            onClick={() => onToggle(tag.text)}
          >
            <TagMark className="group-hover:hidden group-has-[:focus-visible]:hidden" />
            <Chevron open={open} className="hidden group-hover:block group-has-[:focus-visible]:block" />
          </button>
        )}
        {isTag ? (
          <button
            type="button"
            aria-label={tagLabel}
            aria-pressed={isActive || undefined}
            title={title}
            className={SIDEBAR_ROW_LABEL_CLASSES}
            onClick={() => onTagClick(tag.text)}
          >
            {!hasSubTags && <SidebarRowIconSlot icon={HashIcon} />}
            <span ref={labelRef} className="min-w-0 flex-1 truncate">
              {tag.key}
            </span>
            <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{tag.amount}</span>
          </button>
        ) : (
          // A structural segment only exists to reach its children, so the whole row is the
          // disclosure — one control, rather than a row and a chevron doing the same thing.
          <button
            type="button"
            aria-label={`${open ? t("common.collapse") : t("common.expand")} ${tag.text}`}
            aria-expanded={open}
            className={SIDEBAR_ROW_LABEL_CLASSES}
            onClick={() => onToggle(tag.text)}
          >
            <span className={SIDEBAR_ROW_SLOT_CLASSES} aria-hidden="true">
              <Chevron open={open} />
            </span>
            <span ref={labelRef} className="min-w-0 flex-1 truncate" title={title}>
              {tag.key}
            </span>
            {/* Empty count rail keeps structural labels truncating at the same edge as tag labels. */}
            <span aria-hidden="true" className={SIDEBAR_ROW_COUNT_RAIL_CLASSES} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-0.5 flex w-full min-w-0 flex-col gap-0.5" role="group">
          {tag.subTags.map((subTag) => (
            <TagItem
              key={subTag.text}
              tag={subTag}
              depth={depth + 1}
              activeTag={activeTag}
              expanded={expanded}
              onTagClick={onTagClick}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TagTree = ({ tagAmounts, activeTag, scope, onTagClick }: Props) => {
  const t = useTranslate();
  const tags = useMemo(() => buildTagTree(tagAmounts), [tagAmounts]);
  // Scoped per tenant: the paths are one account's tag names, so another user's profile tree
  // must not decide what your own library shows.
  const [state, setState] = useLocalStorage<TagTreeExpansion>(`tag-tree-expanded:${scope}`, EMPTY_EXPANSION);
  const expandedPaths = state?.expanded ?? EMPTY_EXPANSION.expanded;
  const expanded = useMemo(() => new Set(expandedPaths), [expandedPaths]);

  const handleToggle = (path: string) => {
    setState((current) => {
      const paths = current?.expanded ?? [];
      return { ...current, expanded: paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path] };
    });
  };

  // Reveal the active tag when a filter arrives from elsewhere (URL, memo content). `revealedFor`
  // is persisted so this happens once per selection: collapsing afterwards sticks even though the
  // effect runs again on every mount, and re-picking the same tag later reveals it again.
  useEffect(() => {
    setState((current) => {
      if (!activeTag) return current?.revealedFor === undefined ? current : { ...current, revealedFor: undefined };
      if (current?.revealedFor === activeTag) return current;

      const parents = parentPathsOf(activeTag);
      const paths = current?.expanded ?? [];
      const missing = parents.some((path) => !paths.includes(path));
      return { expanded: missing ? [...new Set([...paths, ...parents])] : paths, revealedFor: activeTag };
    });
  }, [activeTag, setState]);

  return (
    <div className="relative flex h-auto w-full flex-col items-stretch gap-0.5" role="tree" aria-label={t("common.tags")}>
      {tags.map((tag) => (
        <TagItem
          key={tag.text}
          tag={tag}
          depth={0}
          activeTag={activeTag}
          expanded={expanded}
          onTagClick={onTagClick}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
};

export default TagTree;
