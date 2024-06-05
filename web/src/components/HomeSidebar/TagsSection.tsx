import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { useFilterStore } from "@/store/module";
import { useMemoList, useTagStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import showRenameTagDialog from "../RenameTagDialog";

interface Props {
  readonly?: boolean;
}

const TagsSection = (props: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const user = useCurrentUser();
  const tagStore = useTagStore();
  const memoList = useMemoList();
  const tagAmounts = Object.entries(tagStore.getState().tagAmounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1]);

  useDebounce(() => fetchTags(), 300, [memoList.size(), location.pathname]);

  const fetchTags = async () => {
    const filters = [`row_status == "NORMAL"`];
    if (user) {
      if (location.pathname === Routes.EXPLORE) {
        filters.push(`visibilities == ["PUBLIC", "PROTECTED"]`);
      }
      filters.push(`creator == "${user.name}"`);
    } else {
      filters.push(`visibilities == ["PUBLIC"]`);
    }
    await tagStore.fetchTags(filters.join(" && "));
  };

  return (
    <div className="flex flex-col justify-start items-start w-full mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 select-none">
        <span>{t("common.tags")}</span>
        {tagAmounts.length > 0 && <span className="shrink-0">({tagAmounts.length})</span>}
      </div>
      {tagAmounts.length > 0 ? (
        <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
          {tagAmounts.map(([tag, amount]) => (
            <TagContainer key={tag} tag={tag} amount={amount} />
          ))}
        </div>
      ) : (
        !props.readonly && (
          <div className="p-2 border border-dashed dark:border-zinc-800 rounded-md flex flex-row justify-start items-start gap-1 text-gray-400 dark:text-gray-500">
            <Icon.Tags />
            <p className="mt-0.5 text-sm leading-snug italic">{t("tag.create-tags-guide")}</p>
          </div>
        )
      )}
    </div>
  );
};

interface TagContainerProps {
  tag: string;
  amount: number;
}

const TagContainer: React.FC<TagContainerProps> = (props: TagContainerProps) => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const tagStore = useTagStore();
  const { tag, amount } = props;

  const handleTagClick = () => {
    if (filterStore.getState().tag === tag) {
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
        await memoServiceClient.deleteMemoTag({
          parent: "memos/-",
          tag: tag,
        });
        await tagStore.fetchTags(undefined, { skipCache: true });
        toast.success(t("message.deleted-successfully"));
      },
    });
  };

  return (
    <div
      className={`shrink-0 w-auto max-w-full text-sm rounded-md leading-6 flex flex-row justify-start items-center select-none hover:opacity-80 text-gray-600 dark:text-gray-400 dark:border-zinc-800`}
    >
      <Dropdown>
        <MenuButton slots={{ root: "div" }}>
          <div className="shrink-0 group">
            <Icon.Hash className="group-hover:hidden w-4 h-auto shrink-0 opacity-40" />
            <Icon.MoreVertical className="hidden group-hover:block w-4 h-auto shrink-0 opacity-60" />
          </div>
        </MenuButton>
        <Menu size="sm" placement="bottom-start">
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
      <div className="inline-flex flex-nowrap ml-0.5 gap-0.5 cursor-pointer max-w-[calc(100%-16px)]" onClick={handleTagClick}>
        <span className="truncate dark:opacity-80">{tag}</span>
        {amount > 1 && <span className="opacity-60 shrink-0">({amount})</span>}
      </div>
    </div>
  );
};

export default TagsSection;
