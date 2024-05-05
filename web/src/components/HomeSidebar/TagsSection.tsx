import { Autocomplete, AutocompleteOption, Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import { useState } from "react";
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
  const tags = tagStore.tags;

  useDebounce(
    () => {
      tagStore.fetchTags();
    },
    300,
    [memoList.size()],
  );

  const [search, setSearch] = useState<string | null>();

  const handleDeleteTag = async (tagValue: string) => {
    showCommonDialog({
      title: t("tag.delete-tag"),
      content: t("tag.delete-confirm"),
      style: "danger",
      dialogName: "delete-tag-dialog",
      onConfirm: async () => {
        await tagStore.deleteTag(tagValue);
        tagStore.fetchTags({ skipCache: true });
        setSearch("");
      },
    });
  };

  return (
    <div className="flex flex-col justify-start items-start w-full mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-start items-center w-full">
        <span className="text-sm leading-6 font-mono text-gray-400 select-none" onDoubleClick={() => showCreateTagDialog()}>
          {t("common.tags")}
        </span>
      </div>
      {tags.size > 0 ? (
        <div className="w-full flex items-center justify-between">
          <Autocomplete
            key={search}
            options={Array.from(tags)}
            autoHighlight
            renderOption={(props, option) => (
              <AutocompleteOption {...props}>
                <div className="relative flex flex-row justify-between items-center w-full leading-6 py-0 mt-px rounded-lg text-sm select-none shrink-0">
                  <div className="flex flex-row justify-start items-center truncate shrink leading-5 mr-1 text-gray-600 dark:text-gray-400">
                    <Icon.Hash className="group-hover:hidden w-4 h-auto shrink-0 opacity-60 mr-1" />
                    <span className="truncate cursor-pointer hover:opacity-80">{option}</span>
                  </div>
                </div>
              </AutocompleteOption>
            )}
            className="w-full"
            value={search || null}
            onChange={(event, searchValue) => {
              setSearch(searchValue);
              filterStore.setTagFilter(searchValue || "");
            }}
          />
          {search && (
            <Dropdown>
              <MenuButton variant="plain">
                <Icon.MoreVertical />
              </MenuButton>
              <Menu size="sm" placement="bottom">
                <MenuItem onClick={() => showRenameTagDialog({ tag: search })}>
                  <Icon.Edit3 className="w-4 h-auto" />
                  {t("common.rename")}
                </MenuItem>
                <MenuItem color="danger" onClick={() => handleDeleteTag(search)}>
                  <Icon.Trash className="w-4 h-auto" />
                  {t("common.delete")}
                </MenuItem>
              </Menu>
            </Dropdown>
          )}
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

export default TagsSection;
