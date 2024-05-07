import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import useDebounce from "react-use/lib/useDebounce";
import { useFilterStore } from "@/store/module";
import { useMemoList, useTagStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import showCreateTagDialog from "../CreateTagDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import showRenameTagDialog from "../RenameTagDialog";

const TagsSection = () => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
  const memoList = useMemoList();
  const filter = filterStore.state;
  const tags = tagStore.tags;

  useDebounce(
    () => {
      tagStore.fetchTags();
    },
    300,
    [memoList.size()],
  );

  return (
    <div className="flex flex-col justify-start items-start w-full mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-start items-center w-full">
        <span className="text-sm leading-6 font-mono text-gray-400 select-none" onDoubleClick={() => showCreateTagDialog()}>
          {t("common.tags")}
        </span>
      </div>
      {tags.size > 0 ? (
        <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap gap-2 mt-1">
          {Array.from(tags).map((tag) => (
            <TagItemContainer key={tag} tag={tag} tagQuery={filter.tag} />
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
  tag: string;
  tagQuery?: string;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
  const { tag, tagQuery } = props;
  const isActive = tagQuery === tag;

  const handleTagClick = () => {
    if (isActive) {
      filterStore.setTagFilter(undefined);
    } else {
      filterStore.setTagFilter(tag);
    }
  };

  const handleDeleteTag = async () => {
    showCommonDialog({
      title: t("tag.delete-tag"),
      content: t("tag.delete-confirm"),
      style: "danger",
      dialogName: "delete-tag-dialog",
      onConfirm: async () => {
        await tagStore.deleteTag(tag);
        tagStore.fetchTags({ skipCache: true });
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
              <MenuItem onClick={() => showRenameTagDialog({ tag: tag })}>
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
            {tag}
          </span>
        </div>
      </div>
    </>
  );
};

export default TagsSection;
