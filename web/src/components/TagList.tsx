import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFilterStore, useTagStore } from "@/store/module";
import useToggle from "@/hooks/useToggle";
import Icon from "./Icon";
import showCreateTagDialog from "./CreateTagDialog";

interface Tag {
  key: string;
  text: string;
  subTags: Tag[];
}

const TagList = () => {
  const { t } = useTranslation();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
  const tagsText = tagStore.state.tags;
  const filter = filterStore.state;
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    tagStore.fetchTags();
  }, []);

  useEffect(() => {
    const sortedTags = Array.from(tagsText).sort();
    const root: KVObject<any> = {
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
  }, [tagsText]);

  return (
    <div className="flex flex-col justify-start items-start w-full py-0 px-1 mt-2 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-start items-center w-full px-4">
        <span className="text-sm leading-6 font-mono text-gray-400">{t("common.tags")}</span>
        <button
          onClick={() => showCreateTagDialog()}
          className="flex flex-col justify-center items-center w-5 h-5 bg-gray-200 dark:bg-zinc-700 rounded ml-2 hover:shadow"
        >
          <Icon.Plus className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap mt-2 mb-2">
        {tags.map((t, idx) => (
          <TagItemContainer key={t.text + "-" + idx} tag={t} tagQuery={filter.tag} />
        ))}
      </div>
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
      <div
        className="relative group flex flex-row justify-between items-center w-full h-10 py-0 px-4 mt-px first:mt-1 rounded-lg text-base cursor-pointer select-none shrink-0 hover:opacity-60"
        onClick={handleTagClick}
      >
        <div
          className={`flex flex-row justify-start items-center truncate shrink leading-5 mr-1 text-black dark:text-gray-200 ${
            isActive && "text-green-600"
          }`}
        >
          <span className="block w-4 shrink-0">#</span>
          <span className="truncate">{tag.key}</span>
        </div>
        <div className="flex flex-row justify-end items-center">
          {hasSubTags ? (
            <span
              className={`flex flex-row justify-center items-center w-6 h-6 shrink-0 transition-all rotate-0 ${showSubTags && "rotate-90"}`}
              onClick={handleToggleBtnClick}
            >
              <Icon.ChevronRight className="w-5 h-5 opacity-80 dark:text-gray-400" />
            </span>
          ) : null}
        </div>
      </div>
      {hasSubTags ? (
        <div
          className={`w-full flex flex-col justify-start items-start h-auto ml-5 pl-1 border-l-2 border-l-gray-200 dark:border-l-gray-400 ${
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

export default TagList;
