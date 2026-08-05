import { ChevronRightIcon, HashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_COUNT_CLASSES, SIDEBAR_ROW_ICON_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface Tag {
  key: string;
  text: string;
  amount: number;
  subTags: Tag[];
}

interface Props {
  tagAmounts: [tag: string, amount: number][];
  expandSubTags: boolean;
}

const TagTree = ({ tagAmounts: rawTagAmounts, expandSubTags }: Props) => {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const sortedTagAmounts = Array.from(rawTagAmounts).sort();
    const root: Tag = {
      key: "",
      text: "",
      amount: 0,
      subTags: [],
    };

    for (const tagAmount of sortedTagAmounts) {
      const subtags = tagAmount[0].split("/");
      let tempObj = root;
      let tagText = "";

      for (let i = 0; i < subtags.length; i++) {
        const key = subtags[i];
        let amount: number = 0;

        if (i === 0) {
          tagText += key;
        } else {
          tagText += "/" + key;
        }
        if (sortedTagAmounts.some(([tag, amount]) => tag === tagText && amount > 1)) {
          amount = tagAmount[1];
        }

        let obj = null;

        for (const t of tempObj.subTags) {
          if (t.text === tagText) {
            obj = t;
            break;
          }
        }

        if (!obj) {
          obj = {
            key,
            text: tagText,
            amount: amount,
            subTags: [],
          };
          tempObj.subTags.push(obj);
        }

        tempObj = obj;
      }
    }

    setTags(root.subTags as Tag[]);
  }, [rawTagAmounts]);

  return (
    <div className="relative flex h-auto w-full flex-col flex-nowrap items-start justify-start gap-0.5">
      {tags.map((t, idx) => (
        <TagItemContainer key={t.text + "-" + idx} tag={t} expandSubTags={expandSubTags} />
      ))}
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  expandSubTags: boolean;
}

const TagItemContainer = (props: TagItemContainerProps) => {
  const { tag, expandSubTags } = props;
  const t = useTranslate();
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const tagFilters = getFiltersByFactor("tagSearch");
  const isActive = tagFilters.some((f: MemoFilter) => f.value === tag.text);
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, setShowSubTags] = useState(false);

  useEffect(() => {
    setShowSubTags(expandSubTags);
  }, [expandSubTags]);

  const handleTagClick = () => {
    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag.text);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "tagSearch");
      addFilter({
        factor: "tagSearch",
        value: tag.text,
      });
    }
  };

  const handleToggleBtnClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowSubTags((current) => !current);
  }, []);

  return (
    <>
      <div
        className={cn(
          SIDEBAR_ROW_CLASSES,
          "shrink-0 select-none",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
        )}
      >
        <button
          type="button"
          aria-pressed={isActive || undefined}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={handleTagClick}
        >
          <HashIcon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
          <span className="min-w-0 flex-1 truncate">{tag.key}</span>
        </button>
        {tag.amount > 1 && <span className={SIDEBAR_ROW_COUNT_CLASSES}>{tag.amount}</span>}
        {hasSubTags && (
          <button
            type="button"
            aria-label={`${showSubTags ? t("common.collapse") : t("common.expand")} ${tag.key}`}
            aria-expanded={showSubTags}
            className={cn(
              "-mr-1 flex size-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-background/70",
              showSubTags && "[&>svg]:rotate-90",
            )}
            onClick={handleToggleBtnClick}
          >
            <ChevronRightIcon className="size-3.5 transition-transform" />
          </button>
        )}
      </div>
      {hasSubTags ? (
        <div
          className={`w-[calc(100%-0.5rem)] flex flex-col justify-start items-start h-auto ml-2 pl-2 border-l-2 border-l-border ${
            !showSubTags && "hidden"
          }`}
        >
          {tag.subTags.map((st, idx) => (
            <TagItemContainer key={st.text + "-" + idx} tag={st} expandSubTags={expandSubTags} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TagTree;
