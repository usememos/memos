import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/utils/i18n";
import { parseRaindropCsv, type RaindropRow } from "./csv";
import { slugifyTag } from "./slugifyTag";
import { useBookmarkImport } from "./useBookmarkImport";

interface BookmarksImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BookmarksImportDialog = ({ open, onOpenChange }: BookmarksImportDialogProps) => {
  const t = useTranslate();
  const [rows, setRows] = useState<RaindropRow[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { progress, start, cancel, reset } = useBookmarkImport();

  const handleFile = useCallback(
    (file: File) => {
      file
        .text()
        .then((text) => {
          const parsed = parseRaindropCsv(text);
          if (parsed.length === 0) {
            setError(t("bookmarks.import-no-rows"));
            setRows([]);
          } else {
            setError("");
            setRows(parsed);
          }
        })
        .catch(() => setError(t("bookmarks.import-read-failed")));
    },
    [t],
  );

  const handleClose = (next: boolean) => {
    cancel();
    reset();
    setRows([]);
    setError("");
    onOpenChange(next);
  };

  const folderTags = new Map<string, number>();
  for (const row of rows) {
    const slug = slugifyTag(row.folder);
    if (slug) {
      folderTags.set(slug, (folderTags.get(slug) ?? 0) + 1);
    }
  }

  const busy = progress.status === "deduping" || progress.status === "importing";
  const donePercent = progress.total > 0 ? Math.round(((progress.created + progress.skipped + progress.failed) / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && handleClose(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bookmarks.import-title")}</DialogTitle>
          <DialogDescription>{t("bookmarks.import-description")}</DialogDescription>
        </DialogHeader>

        {progress.status === "idle" || progress.status === "deduping" ? (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileInput.current?.click()}>
              {t("bookmarks.import-choose-file")}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {rows.length > 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("bookmarks.import-preview-count", { count: rows.length.toString() })}</p>
                {folderTags.size > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {[...folderTags.entries()].map(([slug, count]) => (
                      <span key={slug} className="rounded bg-accent px-1.5 py-0.5 text-xs">
                        #{slug} ({count})
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${donePercent}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("bookmarks.import-progress", {
                created: progress.created.toString(),
                skipped: progress.skipped.toString(),
                failed: progress.failed.toString(),
                total: progress.total.toString(),
              })}
            </p>
            {progress.status === "done" ? <p className="text-sm font-medium text-foreground">{t("bookmarks.import-done")}</p> : null}
          </div>
        )}

        <DialogFooter>
          {busy ? (
            <Button variant="outline" onClick={cancel} disabled={progress.status === "done"}>
              {t("bookmarks.import-cancel")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {progress.status === "done" ? t("common.close") : t("common.cancel")}
              </Button>
              {rows.length > 0 ? (
                <Button
                  onClick={() => {
                    setError("");
                    start(rows);
                  }}
                  disabled={progress.status === "deduping"}
                >
                  {t("bookmarks.import-start")}
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookmarksImportDialog;
