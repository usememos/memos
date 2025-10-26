import { uniqBy } from "lodash-es";
import { LinkIcon } from "lucide-react";
import { useContext, useState } from "react";
import { toast } from "react-hot-toast";
import useDebounce from "react-use/lib/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { memoServiceClient } from "@/grpcweb";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractUserIdFromName } from "@/store/common";
import { Memo, MemoRelation_Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";

const AddMemoRelationPopover = () => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const user = useCurrentUser();
  const [searchText, setSearchText] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  const filteredMemos = fetchedMemos.filter(
    (memo) => memo.name !== context.memoName && !context.relationList.some((relation) => relation.relatedMemo?.name === memo.name),
  );

  useDebounce(
    async () => {
      if (!popoverOpen) return;

      setIsFetching(true);
      try {
        const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
        if (searchText) {
          conditions.push(`content.contains("${searchText}")`);
        }
        const { memos } = await memoServiceClient.listMemos({
          filter: conditions.join(" && "),
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
        });
        setFetchedMemos(memos);
      } catch (error: any) {
        toast.error(error.details);
        console.error(error);
      }
      setIsFetching(false);
    },
    300,
    [popoverOpen, searchText],
  );

  const getHighlightedContent = (content: string) => {
    const index = content.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) {
      return content;
    }
    let before = content.slice(0, index);
    if (before.length > 20) {
      before = "..." + before.slice(before.length - 20);
    }
    const highlighted = content.slice(index, index + searchText.length);
    let after = content.slice(index + searchText.length);
    if (after.length > 20) {
      after = after.slice(0, 20) + "...";
    }

    return (
      <>
        {before}
        <mark className="font-medium">{highlighted}</mark>
        {after}
      </>
    );
  };

  const addMemoRelations = async (memo: Memo) => {
    context.setRelationList(
      uniqBy(
        [
          {
            memo: MemoRelation_Memo.fromPartial({ name: memo.name }),
            relatedMemo: MemoRelation_Memo.fromPartial({ name: memo.name }),
            type: MemoRelation_Type.REFERENCE,
          },
          ...context.relationList,
        ].filter((relation) => relation.relatedMemo !== context.memoName),
        "relatedMemo",
      ),
    );
    setPopoverOpen(false);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <LinkIcon className="size-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("tooltip.link-memo")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="center">
        <div className="w-[16rem] p-1 flex flex-col justify-start items-start">
          {/* Search and selection interface */}
          <div className="w-full">
            <Input
              placeholder={t("reference.search-placeholder")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="mb-2 !text-sm"
            />
            <div className="max-h-[200px] overflow-y-auto">
              {filteredMemos.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {isFetching ? "Loading..." : t("reference.no-memos-found")}
                </div>
              ) : (
                filteredMemos.map((memo) => (
                  <div
                    key={memo.name}
                    className="relative flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      addMemoRelations(memo);
                    }}
                  >
                    <div className="w-full flex flex-col justify-start items-start">
                      <p className="text-xs text-muted-foreground select-none">{memo.displayTime?.toLocaleString()}</p>
                      <p className="mt-0.5 text-sm leading-5 line-clamp-2">
                        {searchText ? getHighlightedContent(memo.content) : memo.snippet}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddMemoRelationPopover;
