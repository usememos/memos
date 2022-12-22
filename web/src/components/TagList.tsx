import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocationStore, useTagStore } from "../store/module";
import useToggle from "../hooks/useToggle";
import Icon from "./Icon";
import showCreateTagDialog from "./CreateTagDialog";
import "../less/tag-list.less";

interface Tag {
  key: string;
  text: string;
  subTags: Tag[];
}

const TagList = () => {
  const { t } = useTranslation();
  const locationStore = useLocationStore();
  const tagStore = useTagStore();
  const tagsText = tagStore.state.tags;
  const query = locationStore.state.query;
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
    <div className="tags-wrapper">
      <div className="w-full flex flex-row justify-start items-center px-4 mb-1">
        <span className="text-sm leading-6 font-mono text-gray-400">{t("common.tags")}</span>
        <button
          onClick={() => showCreateTagDialog()}
          className="flex flex-col justify-center items-center w-5 h-5 bg-gray-200 dark:bg-zinc-700 rounded ml-2 hover:shadow"
        >
          <Icon.Plus className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="tags-container">
        {tags.map((t, idx) => (
          <TagItemContainer key={t.text + "-" + idx} tag={t} tagQuery={query?.tag} />
        ))}
        {tags.length < 3 && <p className="tip-text">{t("tag-list.tip-text")}</p>}
      </div>
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  tagQuery?: string;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const locationStore = useLocationStore();
  const { tag, tagQuery } = props;
  const isActive = tagQuery === tag.text;
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, toggleSubTags] = useToggle(false);

  const handleTagClick = () => {
    if (isActive) {
      locationStore.setTagQuery(undefined);
    } else {
      locationStore.setTagQuery(tag.text);
    }
  };

  const handleToggleBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleSubTags();
  };

  return (
    <>
      <div className={`tag-item-container ${isActive ? "active" : ""}`} onClick={handleTagClick}>
        <div className="tag-text-container">
          <span className="icon-text">#</span>
          <span className="tag-text">{tag.key}</span>
        </div>
        <div className="btns-container">
          {hasSubTags ? (
            <span className={`action-btn toggle-btn ${showSubTags ? "shown" : ""}`} onClick={handleToggleBtnClick}>
              <Icon.ChevronRight className="icon-img" />
            </span>
          ) : null}
        </div>
      </div>

      {hasSubTags ? (
        <div className={`subtags-container ${showSubTags ? "" : "!hidden"}`}>
          {tag.subTags.map((st, idx) => (
            <TagItemContainer key={st.text + "-" + idx} tag={st} tagQuery={tagQuery} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TagList;
