import { useEffect, useState } from "react";
import useToggle from "react-use/lib/useToggle";
import { useFilterStore } from "@/store/module";
import Icon from "./Icon";

interface Tag {
  key: string;
  text: string;
  subTags: Tag[];
}

interface Props {
  tags: string[];
}

const TagTree = ({ tags: rawTags }: Props) => {
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const sortedTags = Array.from(rawTags).sort();
    const root: Tag = {
      key: "",
      text: "",
      subTags: [],
    };

    for (const tag of sortedTags) {
      const subtags = tag.split("/");
      let tempObj = root;
      let tagText = "";

      for (let i = 0; i < subtags.length; i++) {
        const key = subtags[i];
        if (i === 0) {
          tagText += key;
        } else {
          tagText += "/" + key;
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
            subTags: [],
          };
          tempObj.subTags.push(obj);
        }

        tempObj = obj;
      }
    }

    setTags(root.subTags as Tag[]);
  }, [rawTags]);

  return (
    <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap gap-2 mt-1">
      {tags.map((t, idx) => (
        <TagItemContainer key={t.text + "-" + idx} tag={t} tagQuery={filter.tag} />
      ))}
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  tagQuery?: string;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const filterStore = useFilterStore();
  const { tag, tagQuery } = props;
  const isActive = tagQuery === tag.text;
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, toggleSubTags] = useToggle(false);

  const handleTagClick = () => {
    if (isActive) {
      filterStore.setTagFilter(undefined);
    } else {
      filterStore.setTagFilter(tag.text);
    }
  };

  const handleToggleBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleSubTags();
  };

  return (
    <>
      <div className="relative flex flex-row justify-between items-center w-full leading-6 py-0 mt-px rounded-lg text-sm select-none shrink-0">
        <div
          className={`flex flex-row justify-start items-center truncate shrink leading-5 mr-1 text-gray-600 dark:text-gray-400 ${
            isActive && "!text-blue-600"
          }`}
        >
          <div className="shrink-0">
            <Icon.Hash className="w-4 h-auto shrink-0 mr-1 text-gray-400 dark:text-gray-500" />
          </div>
          <span className="truncate cursor-pointer hover:opacity-80" onClick={handleTagClick}>
            {tag.key}
          </span>
        </div>
        <div className="flex flex-row justify-end items-center">
          {hasSubTags ? (
            <span
              className={`flex flex-row justify-center items-center w-6 h-6 shrink-0 transition-all rotate-0 ${showSubTags && "rotate-90"}`}
              onClick={handleToggleBtnClick}
            >
              <Icon.ChevronRight className="w-5 h-5 cursor-pointer text-gray-400 dark:text-gray-500" />
            </span>
          ) : null}
        </div>
      </div>
      {hasSubTags ? (
        <div
          className={`w-[calc(100%-0.5rem)] flex flex-col justify-start items-start h-auto ml-2 pl-2 border-l-2 border-l-gray-200 dark:border-l-zinc-800 ${
            !showSubTags && "!hidden"
          }`}
        >
          {tag.subTags.map((st, idx) => (
            <TagItemContainer key={st.text + "-" + idx} tag={st} tagQuery={tagQuery} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TagTree;
