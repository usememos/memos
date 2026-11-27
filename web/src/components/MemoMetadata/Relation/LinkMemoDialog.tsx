import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Dialog, Input } from "@usememos/ui";
import { LinkIcon } from "lucide-react";
import { MemoPreview } from "@/components/MemoPreview";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface LinkMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  filteredMemos: Memo[];
  isFetching: boolean;
  onSelectMemo: (memo: Memo) => void;
  isAlreadyLinked: (memoName: string) => boolean;
}

export const LinkMemoDialog = ({
  open,
  onOpenChange,
  searchText,
  onSearchChange,
  filteredMemos,
  isFetching,
  onSelectMemo,
  isAlreadyLinked,
}: LinkMemoDialogProps) => {
  const t = useTranslate();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup variant="bare" sheet={false} className="w-md">
        <Dialog.Title className="mu-visually-hidden">{t("tooltip.link-memo")}</Dialog.Title>
        <Dialog.Description className="mu-visually-hidden">{t("tooltip.link-memo-description")}</Dialog.Description>
        <div className="flex flex-col">
          <div className="p-3">
            <Input
              aria-label={t("reference.search-placeholder")}
              placeholder={t("reference.search-placeholder")}
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className="border-t border-mu-line" />
          <div className="max-h-[320px] overflow-y-auto">
            {filteredMemos.length === 0 ? (
              <div className="py-8 text-center mu-body text-mu-text-secondary">
                {isFetching ? "Loading..." : t("reference.no-memos-found")}
              </div>
            ) : (
              filteredMemos.map((memo) => {
                const alreadyLinked = isAlreadyLinked(memo.name);
                return (
                  <div
                    key={memo.name}
                    className={cn(
                      "flex cursor-pointer items-start border-b border-mu-line last:border-b-0 px-3 py-2.5 hover:bg-mu-hover/50 transition-colors",
                      alreadyLinked && "opacity-40 cursor-default",
                    )}
                    onClick={() => !alreadyLinked && onSelectMemo(memo)}
                  >
                    <div className="w-full flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 mu-body text-mu-text-secondary select-none">
                        {alreadyLinked && <LinkIcon className="mu-icon-xs shrink-0" />}
                        <span>{memo.createTime && timestampDate(memo.createTime).toLocaleString()}</span>
                      </div>
                      <MemoPreview name={memo.name} content={memo.content} attachments={memo.attachments} showMemoId />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};
