import { uniqBy } from "lodash-es";
import { LinkIcon, X } from "lucide-react";
import React, { useContext, useState } from "react";
import { toast } from "react-hot-toast";
import useDebounce from "react-use/lib/useDebounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { memoServiceClient } from "@/grpcweb";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractMemoIdFromName } from "@/store/common";
import { Memo, MemoRelation_Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";
import { MemoEditorContext } from "../types";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const AddMemoRelationPopover = (props: Props) => {
  const { editorRef } = props;
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const user = useCurrentUser();
  const [searchText, setSearchText] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);
  const [selectedMemos, setSelectedMemos] = useState<Memo[]>([]);
  const [embedded, setEmbedded] = useState<boolean>(false);
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  const filteredMemos = fetchedMemos.filter(
    (memo) =>
      !selectedMemos.includes(memo) &&
      memo.name !== context.memoName &&
      !context.relationList.some((relation) => relation.relatedMemo?.name === memo.name),
  );

  useDebounce(
    async () => {
      if (!popoverOpen) return;

      setIsFetching(true);
      try {
        const conditions = [];
        if (searchText) {
          conditions.push(`content_search == [${JSON.stringify(searchText)}]`);
        }
        const { memos } = await memoServiceClient.listMemos({
          parent: user.name,
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
          oldFilter: conditions.length > 0 ? conditions.join(" && ") : undefined,
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

  const addMemoRelations = async () => {
    // If embedded mode is enabled, embed the memo instead of creating a relation.
    if (embedded) {
      if (!editorRef.current) {
        toast.error(t("message.failed-to-embed-memo"));
        return;
      }

      const cursorPosition = editorRef.current.getCursorPosition();
      const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
      if (prevValue !== "" && !prevValue.endsWith("\n")) {
        editorRef.current.insertText("\n");
      }
      for (const memo of selectedMemos) {
        editorRef.current.insertText(`![[memos/${extractMemoIdFromName(memo.name)}]]\n`);
      }
      setTimeout(() => {
        editorRef.current?.scrollToCursor();
        editorRef.current?.focus();
      });
    } else {
      context.setRelationList(
        uniqBy(
          [
            ...selectedMemos.map((memo) => ({
              memo: MemoRelation_Memo.fromPartial({ name: memo.name }),
              relatedMemo: MemoRelation_Memo.fromPartial({ name: memo.name }),
              type: MemoRelation_Type.REFERENCE,
            })),
            ...context.relationList,
          ].filter((relation) => relation.relatedMemo !== context.memoName),
          "relatedMemo",
        ),
      );
    }
    setSelectedMemos([]);
    setPopoverOpen(false);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost">
          <LinkIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center">
        <div className="w-[16rem] p-1 flex flex-col justify-start items-start">
          {/* Selected memos display */}
          {selectedMemos.length > 0 && (
            <div className="w-full mb-2 flex flex-wrap gap-1">
              {selectedMemos.map((memo) => (
                <Badge key={memo.name} variant="outline" className="max-w-full flex items-center gap-1 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 select-none">{memo.displayTime?.toLocaleString()}</p>
                    <span className="text-sm leading-5 truncate block">{memo.content}</span>
                  </div>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 flex-shrink-0"
                    onClick={() => setSelectedMemos((memos) => memos.filter((m) => m.name !== memo.name))}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Search and selection interface */}
          <Command className="w-full">
            <CommandInput
              placeholder={t("reference.search-placeholder")}
              value={searchText}
              onValueChange={setSearchText}
              className="h-9"
            />
            <CommandList className="max-h-[200px]">
              <CommandEmpty>{isFetching ? "Loading..." : t("reference.no-memos-found")}</CommandEmpty>
              {filteredMemos.map((memo) => (
                <CommandItem
                  key={memo.name}
                  value={memo.name}
                  onSelect={() => {
                    setSelectedMemos((prev) => [...prev, memo]);
                  }}
                  className="cursor-pointer"
                >
                  <div className="w-full flex flex-col justify-start items-start">
                    <p className="text-xs text-gray-400 select-none">{memo.displayTime?.toLocaleString()}</p>
                    <p className="mt-0.5 text-sm leading-5 line-clamp-2">
                      {searchText ? getHighlightedContent(memo.content) : memo.snippet}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>

          <div className="mt-2 w-full flex flex-row justify-end items-center gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="embed-checkbox" checked={embedded} onCheckedChange={(checked) => setEmbedded(checked === true)} />
              <label htmlFor="embed-checkbox" className="text-sm">
                Embed
              </label>
            </div>
            <Button onClick={addMemoRelations} disabled={selectedMemos.length === 0}>
              {t("common.add")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddMemoRelationPopover;
