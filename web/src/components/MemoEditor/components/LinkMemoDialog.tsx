import { timestampDate } from "@bufbuild/protobuf/wkt";
import { LinkIcon } from "lucide-react";
import { MemoPreview } from "@/components/MemoPreview";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { LinkMemoDialogProps } from "../types";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))] p-0!" showCloseButton={false}>
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogTitle>{t("tooltip.link-memo")}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>Search and select a memo to link</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col">
          <div className="p-3">
            <Input
              placeholder={t("reference.search-placeholder")}
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="!text-sm h-9"
              autoFocus
            />
          </div>
          <div className="border-t border-border" />
          <div className="max-h-[320px] overflow-y-auto">
            {filteredMemos.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isFetching ? "Loading..." : t("reference.no-memos-found")}
              </div>
            ) : (
              filteredMemos.map((memo) => {
                const alreadyLinked = isAlreadyLinked(memo.name);
                return (
                  <div
                    key={memo.name}
                    className={cn(
                      "flex cursor-pointer items-start border-b border-border last:border-b-0 px-3 py-2.5 hover:bg-accent/50 transition-colors",
                      alreadyLinked && "opacity-40 cursor-default",
                    )}
                    onClick={() => !alreadyLinked && onSelectMemo(memo)}
                  >
                    <div className="w-full flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground select-none">
                        {alreadyLinked && <LinkIcon className="w-3 h-3 shrink-0" />}
                        <span className="text-xs font-mono px-1 py-0.5 rounded border border-border bg-muted/40 shrink-0">
                          {extractMemoIdFromName(memo.name).slice(0, 6)}
                        </span>
                        <span>{memo.displayTime && timestampDate(memo.displayTime).toLocaleString()}</span>
                      </div>
                      <MemoPreview content={memo.content} attachments={memo.attachments} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
