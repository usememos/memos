import { DownloadIcon, ImageIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoView/MemoViewContext";
import MemoShareImagePreview from "./MemoShareImagePreview";
import {
  buildMemoShareImageFileName,
  createMemoShareImageBlob,
  getMemoShareDialogWidth,
  getMemoSharePreviewWidth,
  getMemoShareRenderWidth,
} from "./memoShareImage";

interface MemoShareImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MemoShareImageDialog = ({ open, onOpenChange }: MemoShareImageDialogProps) => {
  const t = useTranslate();
  const { memo, cardWidth } = useMemoViewContext();
  const previewRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  const previewWidth = useMemo(() => getMemoSharePreviewWidth(cardWidth), [cardWidth]);
  const dialogWidth = useMemo(() => getMemoShareDialogWidth(previewWidth), [previewWidth]);
  const previewRenderWidth = useMemo(() => getMemoShareRenderWidth(previewWidth, dialogWidth), [dialogWidth, previewWidth]);

  const createShareBlob = useCallback(async () => {
    const preview = previewRef.current;
    if (!preview) {
      throw new Error("Preview is not ready");
    }

    return createMemoShareImageBlob(preview);
  }, []);

  const handleDownload = useCallback(async () => {
    setIsRendering(true);
    try {
      const blob = await createShareBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildMemoShareImageFileName(memo.name);
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t("memo.share.image-downloaded"));
    } catch {
      toast.error(t("memo.share.image-download-failed"));
    } finally {
      setIsRendering(false);
    }
  }, [createShareBlob, memo.name, t]);

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator.share !== "function") {
      return;
    }

    setIsRendering(true);
    try {
      const blob = await createShareBlob();
      const file = new File([blob], buildMemoShareImageFileName(memo.name), { type: "image/png" });
      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
        toast.error(t("memo.share.image-share-failed"));
        return;
      }

      await navigator.share({
        files: [file],
        title: memo.content.slice(0, 60),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(t("memo.share.image-share-failed"));
      }
    } finally {
      setIsRendering(false);
    }
  }, [createShareBlob, memo.content, memo.name, t]);

  const supportsNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="min-h-0 overflow-hidden !gap-0 !p-0 md:w-auto md:max-w-none"
        style={{ width: `${dialogWidth}px` }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
            <DialogTitle className="flex items-center gap-2 text-base font-medium">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              {t("memo.share.image-title")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("memo.share.image-description", { width: previewRenderWidth })}</DialogDescription>
          </DialogHeader>

          <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/20 px-4 py-3 sm:px-5 sm:py-4">
            <MemoShareImagePreview ref={previewRef} width={previewRenderWidth} />
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-5">
            {supportsNativeShare && (
              <Button
                variant="ghost"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={handleNativeShare}
                disabled={isRendering}
              >
                {isRendering ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <Share2Icon className="mr-2 h-4 w-4" />}
                {t("memo.share.image-share")}
              </Button>
            )}
            <Button
              variant="outline"
              className="border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={handleDownload}
              disabled={isRendering}
            >
              {isRendering ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <DownloadIcon className="mr-2 h-4 w-4" />}
              {t("memo.share.image-download")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemoShareImageDialog;
