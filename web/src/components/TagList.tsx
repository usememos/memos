import { useContext, useEffect, useState } from "react";
import appContext from "../stores/appContext";
import { locationService, memoService } from "../services";
import useToggle from "../hooks/useToggle";
import Only from "./common/OnlyWhen";
import utils from "../helpers/utils";
import "../less/tag-list.less";

interface Tag {
  key: string;
  text: string;
  subTags: Tag[];
}

interface Props {}

const TagList: React.FC<Props> = () => {
  const {
    locationState: {
      query: { tag: tagQuery },
    },
    memoState: { tags: tagsText, memos },
  } = useContext(appContext);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    memoService.updateTagsState();
  }, [memos]);

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
      <p className="title-text">Tags</p>
      <div className="tags-container">
        {tags.map((t, idx) => (
          <TagItemContainer key={t.text + "-" + idx} tag={t} tagQuery={tagQuery} />
        ))}
        <Only when={tags.length < 5 && memoService.initialized}>
          <p className="tag-tip-container">
            Enter <span className="code-text">#tag </span> to create a tag
          </p>
        </Only>
      </div>
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  tagQuery: string;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const { tag, tagQuery } = props;
  const isActive = tagQuery === tag.text;
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, toggleSubTags] = useToggle(false);

  const handleTagClick = () => {
    if (isActive) {
      locationService.setTagQuery("");
    } else {
      utils.copyTextToClipboard(`#${tag.text} `);
      if (!["/"].includes(locationService.getState().pathname)) {
        locationService.setPathname("/");
      }
      locationService.setTagQuery(tag.text);
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
              <img className="icon-img" src="/icons/arrow-right.svg" />
            </span>
          ) : null}
        </div>
      </div>

      {hasSubTags ? (
        <div className={`subtags-container ${showSubTags ? "" : "hidden"}`}>
          {tag.subTags.map((st, idx) => (
            <TagItemContainer key={st.text + "-" + idx} tag={st} tagQuery={tagQuery} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TagList;
