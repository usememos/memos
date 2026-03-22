import { ChevronRightIcon, HashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import useToggle from "react-use/lib/useToggle";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";

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
    <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap gap-2 mt-1">
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
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const tagFilters = getFiltersByFactor("tagSearch");
  const isActive = tagFilters.some((f: MemoFilter) => f.value === tag.text);
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, toggleSubTags] = useToggle(false);

  useEffect(() => {
    toggleSubTags(expandSubTags);
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

  const handleToggleBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleSubTags();
  };

  return (
    <>
      <div className="relative flex flex-row justify-between items-center w-full leading-6 py-0 mt-px text-sm select-none shrink-0">
        <div
          className={`flex flex-row justify-start items-center truncate shrink leading-5 mr-1 cursor-pointer transition-colors ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
          onClick={handleTagClick}
        >
          <HashIcon className="w-4 h-auto shrink-0 mr-1" />
          <span className={`truncate hover:opacity-80 ${isActive ? "font-medium" : ""}`}>
            {tag.key} {tag.amount > 1 && <span className="opacity-60">({tag.amount})</span>}
          </span>
        </div>
        <div className="flex flex-row justify-end items-center">
          {hasSubTags ? (
            <span
              className={`flex flex-row justify-center items-center w-6 h-6 shrink-0 transition-all rotate-0 cursor-pointer ${
                showSubTags && "rotate-90"
              }`}
              onClick={handleToggleBtnClick}
            >
              <ChevronRightIcon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </span>
          ) : null}
        </div>
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
