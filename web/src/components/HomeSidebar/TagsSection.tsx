import { Edit3Icon, HashIcon, MoreVerticalIcon, TagsIcon, TrashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import toast from "react-hot-toast";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Switch } from "@/components/ui/switch";
import { memoServiceClient } from "@/grpcweb";
import { cn } from "@/lib/utils";
import { userStore } from "@/store/v2";
import memoFilterStore, { MemoFilter } from "@/store/v2/memoFilter";
import { useTranslate } from "@/utils/i18n";
import showRenameTagDialog from "../RenameTagDialog";
import TagTree from "../TagTree";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface Props {
  readonly?: boolean;
}

const TagsSection = observer((props: Props) => {
  const t = useTranslate();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const tags = Object.entries(userStore.state.tagCount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1]);

  const handleTagClick = (tag: string) => {
    const isActive = memoFilterStore.getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      memoFilterStore.removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      memoFilterStore.addFilter({
        factor: "tagSearch",
        value: tag,
      });
    }
  };

  const handleDeleteTag = async (tag: string) => {
    const confirmed = window.confirm(t("tag.delete-confirm"));
    if (confirmed) {
      await memoServiceClient.deleteMemoTag({
        parent: "memos/-",
        tag: tag,
      });
      toast.success(t("message.deleted-successfully"));
    }
  };

  return (
    <div className="flex flex-col justify-start items-start w-full mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-between items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
        <span>{t("common.tags")}</span>
        {tags.length > 0 && (
          <Popover>
            <PopoverTrigger>
              <MoreVerticalIcon className="w-4 h-auto shrink-0 opacity-60" />
            </PopoverTrigger>
            <PopoverContent align="end" alignOffset={-12}>
              <div className="w-auto flex flex-row justify-between items-center gap-2 p-1">
                <span className="text-sm shrink-0">{t("common.tree-mode")}</span>
                <Switch checked={treeMode} onCheckedChange={(checked) => setTreeMode(checked)} />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {tags.length > 0 ? (
        treeMode ? (
          <TagTree tagAmounts={tags} />
        ) : (
          <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
            {tags.map(([tag, amount]) => (
              <div
                key={tag}
                className="shrink-0 w-auto max-w-full text-sm rounded-md leading-6 flex flex-row justify-start items-center select-none hover:opacity-80 text-muted-foreground"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="shrink-0 group cursor-pointer">
                      <HashIcon className="group-hover:hidden w-4 h-auto shrink-0 opacity-40" />
                      <MoreVerticalIcon className="hidden group-hover:block w-4 h-auto shrink-0 opacity-60" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={2}>
                    <div className="flex flex-col text-sm gap-0.5">
                      <button
                        onClick={() => showRenameTagDialog({ tag: tag })}
                        className="flex items-center gap-2 px-2 py-1 text-left hover:bg-muted outline-none rounded"
                      >
                        <Edit3Icon className="w-4 h-auto" />
                        {t("common.rename")}
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className="flex items-center gap-2 px-2 py-1 text-left text-destructive hover:bg-muted outline-none rounded"
                      >
                        <TrashIcon className="w-4 h-auto" />
                        {t("common.delete")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
                <div
                  className={cn("inline-flex flex-nowrap ml-0.5 gap-0.5 cursor-pointer max-w-[calc(100%-16px)]")}
                  onClick={() => handleTagClick(tag)}
                >
                  <span className="truncate opacity-80">{tag}</span>
                  {amount > 1 && <span className="opacity-60 shrink-0">({amount})</span>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        !props.readonly && (
          <div className="p-2 border border-dashed rounded-md flex flex-row justify-start items-start gap-1 text-muted-foreground">
            <TagsIcon />
            <p className="mt-0.5 text-sm leading-snug italic">{t("tag.create-tags-guide")}</p>
          </div>
        )
      )}
    </div>
  );
});

export default TagsSection;
