import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslate } from "@/utils/i18n";
import type { LinkMemoDialogProps } from "../types";

function highlightSearchText(content: string, searchText: string): React.ReactNode {
  if (!searchText) return content;

  const index = content.toLowerCase().indexOf(searchText.toLowerCase());
  if (index === -1) return content;

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
}

export const LinkMemoDialog = ({
  open,
  onOpenChange,
  searchText,
  onSearchChange,
  filteredMemos,
  isFetching,
  onSelectMemo,
}: LinkMemoDialogProps) => {
  const t = useTranslate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tooltip.link-memo")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder={t("reference.search-placeholder")}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="!text-sm"
          />
          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            {filteredMemos.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isFetching ? "Loading..." : t("reference.no-memos-found")}
              </div>
            ) : (
              filteredMemos.map((memo) => (
                <div
                  key={memo.name}
                  className="relative flex cursor-pointer items-start gap-2 border-b last:border-b-0 px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                  onClick={() => onSelectMemo(memo)}
                >
                  <div className="w-full flex flex-col justify-start items-start">
                    <p className="text-xs text-muted-foreground select-none">
                      {memo.displayTime && timestampDate(memo.displayTime).toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-sm leading-5 line-clamp-2">
                      {searchText ? highlightSearchText(memo.content, searchText) : memo.snippet}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
