import { UploadCloudIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { parseRaindropCsvAsync, type RaindropRow } from "./csv";
import { slugifyTag } from "./slugifyTag";
import { useBookmarkImport } from "./useBookmarkImport";

interface BookmarksImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Cap exports at 10 MiB before reading or transferring them to the parser worker.
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const BookmarksImportDialog = ({ open, onOpenChange }: BookmarksImportDialogProps) => {
  const t = useTranslate();
  const [rows, setRows] = useState<RaindropRow[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileRead = useRef(0);
  const activeParse = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { progress, start, cancel, reset } = useBookmarkImport();

  const busy = progress.status === "deduping" || progress.status === "importing" || progress.status === "cancelling";
  useEffect(
    () => () => {
      fileRead.current++;
      activeParse.current?.abort();
    },
    [],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (busy) return;
      activeParse.current?.abort();
      const parse = new AbortController();
      activeParse.current = parse;
      const read = ++fileRead.current;
      setRows([]);
      setError("");
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        setError(t("bookmarks.import-invalid-file"));
        return;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        setError(t("bookmarks.import-file-too-large"));
        return;
      }
      file
        .text()
        .then((text) => {
          if (fileRead.current !== read) throw new DOMException("File replaced", "AbortError");
          return parseRaindropCsvAsync(text, parse.signal);
        })
        .then((parsed) => {
          if (fileRead.current !== read) return;
          if (parsed.length === 0) {
            setError(t("bookmarks.import-no-rows"));
            setRows([]);
          } else {
            setError("");
            setRows(parsed);
          }
        })
        .catch(() => {
          if (fileRead.current === read) setError(t("bookmarks.import-read-failed"));
        })
        .finally(() => {
          if (activeParse.current === parse) activeParse.current = null;
        });
    },
    [t, busy],
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
    fileRead.current++;
    activeParse.current?.abort();
    activeParse.current = null;
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

  const donePercent = progress.total > 0 ? Math.round(((progress.created + progress.skipped + progress.failed) / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && handleClose(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bookmarks.import-title")}</DialogTitle>
          <DialogDescription>{t("bookmarks.import-description")}</DialogDescription>
        </DialogHeader>

        {progress.status === "idle" || progress.status === "error" ? (
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
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {progress.status === "error" ? (
              <p role="alert" className="text-sm text-destructive">
                {t("bookmarks.import-dedupe-failed")}
              </p>
            ) : null}
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
          <div className="space-y-3" aria-live="polite">
            {progress.status === "deduping" ? <p className="text-sm">{t("bookmarks.import-checking")}</p> : null}
            {progress.status === "cancelling" ? <p className="text-sm">{t("bookmarks.import-cancelling")}</p> : null}
            {progress.status === "cancelled" ? <p className="text-sm">{t("bookmarks.import-cancelled")}</p> : null}
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
            <Button variant="outline" onClick={cancel} disabled={progress.status === "cancelling"}>
              {t("bookmarks.import-cancel")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {progress.status === "done" || progress.status === "cancelled" ? t("common.close") : t("common.cancel")}
              </Button>
              {rows.length > 0 && (progress.status === "idle" || progress.status === "error") ? (
                <Button
                  onClick={() => {
                    setError("");
                    start(rows);
                  }}
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
