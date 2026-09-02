import { UploadCloudIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const { progress, start, cancel, reset } = useBookmarkImport();

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setError(t("bookmarks.import-invalid-file"));
        return;
      }
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClose = (next: boolean) => {
    cancel();
    reset();
    setRows([]);
    setError("");
    setIsDragging(false);
    dragCounterRef.current = 0;
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
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInput.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={t("bookmarks.import-choose-file")}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragging
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-accent/30 text-muted-foreground",
              )}
            >
              <div className="pointer-events-none flex flex-col items-center gap-1.5">
                <UploadCloudIcon
                  className={cn("size-8 text-muted-foreground transition-transform", isDragging && "scale-110 text-primary")}
                  strokeWidth={1.8}
                />
                <p className="text-sm font-medium text-foreground">{t("bookmarks.import-choose-file")}</p>
                <p className="text-xs text-muted-foreground">{t("bookmarks.import-drop-hint")}</p>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {rows.length > 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("bookmarks.import-preview-count", { count: rows.length.toString() })}</p>
                {folderTags.size > 0 ? (
                  <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-2 [scrollbar-width:thin]">
                    <div className="flex flex-wrap gap-1">
                      {[...folderTags.entries()].map(([slug, count]) => (
                        <span key={slug} className="rounded bg-accent px-1.5 py-0.5 text-xs">
                          #{slug} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div
              role="progressbar"
              aria-valuenow={donePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("bookmarks.import-progress-label")}
              className="h-2 w-full overflow-hidden rounded bg-muted"
            >
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
