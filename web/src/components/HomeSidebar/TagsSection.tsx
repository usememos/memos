import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import { useEffect, useState } from "react";
import useToggle from "react-use/lib/useToggle";
import { useFilterStore, useTagStore } from "@/store/module";
import { useMemoList } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import showCreateTagDialog from "../CreateTagDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import showRenameTagDialog from "../RenameTagDialog";

interface KVObject<T = any> {
  [key: string]: T;
}

interface Tag {
  key: string;
  text: string;
  subTags: Tag[];
}

const TagsSection = () => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
  const memoList = useMemoList();
  const tagsText = tagStore.state.tags;
  const filter = filterStore.state;
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    tagStore.fetchTags();
  }, [memoList.size()]);

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
    <div className="flex flex-col justify-start items-start w-full mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-start items-center w-full">
        <span className="text-sm leading-6 font-mono text-gray-400 select-none" onDoubleClick={() => showCreateTagDialog()}>
          {t("common.tags")}
        </span>
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap gap-2 mt-1">
          {tags.map((t, idx) => (
            <TagItemContainer key={t.text + "-" + idx} tag={t} tagQuery={filter.tag} />
          ))}
        </div>
      ) : (
        <div className="p-2 border rounded-md flex flex-row justify-start items-start gap-1 text-gray-400 dark:text-gray-500">
          <Icon.ThumbsUp />
          <p className="mt-0.5 text-sm leading-snug italic">{t("tag.create-tags-guide")}</p>
        </div>
      )}
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  tagQuery?: string;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
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

  const handleDeleteTag = async () => {
    showCommonDialog({
      title: t("tag.delete-tag"),
      content: t("tag.delete-confirm"),
      style: "danger",
      dialogName: "delete-tag-dialog",
      onConfirm: async () => {
        await tagStore.deleteTag(tag.text);
      },
    });
  };

  return (
    <>
      <div className="relative flex flex-row justify-between items-center w-full leading-6 py-0 mt-px rounded-lg text-sm select-none shrink-0">
        <div
          className={`flex flex-row justify-start items-center truncate shrink leading-5 mr-1 text-gray-600 dark:text-gray-400 ${
            isActive && "!text-blue-600"
          }`}
        >
          <Dropdown>
            <MenuButton slots={{ root: "div" }}>
              <div className="shrink-0 group">
                <Icon.Hash className="group-hover:hidden w-4 h-auto shrink-0 opacity-60 mr-1" />
                <Icon.MoreVertical className="hidden group-hover:block w-4 h-auto shrink-0 opacity-60 mr-1" />
              </div>
            </MenuButton>
            <Menu size="sm" placement="bottom">
              <MenuItem onClick={() => showRenameTagDialog({ tag: tag.text })}>
                <Icon.Edit3 className="w-4 h-auto" />
                {t("common.rename")}
              </MenuItem>
              <MenuItem color="danger" onClick={handleDeleteTag}>
                <Icon.Trash className="w-4 h-auto" />
                {t("common.delete")}
              </MenuItem>
            </Menu>
          </Dropdown>
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
              <Icon.ChevronRight className="w-5 h-5 cursor-pointer opacity-40 dark:text-gray-400" />
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

export default TagsSection;
