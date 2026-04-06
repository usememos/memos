import { DownloadIcon, ImageIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoView/MemoViewContext";
import MemoShareImagePreview from "./MemoShareImagePreview";
import { buildMemoShareImageFileName, createMemoShareImageBlob, getMemoShareDialogWidth, getMemoSharePreviewWidth } from "./memoShareImage";

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
      <DialogContent size="full" className="md:w-auto md:max-w-none" style={{ width: `${dialogWidth}px` }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {t("memo.share.image-title")}
          </DialogTitle>
          <DialogDescription>{t("memo.share.image-description", { width: previewWidth })}</DialogDescription>
        </DialogHeader>

        <div className="overflow-auto p-1 sm:p-2">
          <MemoShareImagePreview ref={previewRef} width={previewWidth} />
        </div>

        <DialogFooter>
          {supportsNativeShare && (
            <Button variant="outline" onClick={handleNativeShare} disabled={isRendering}>
              {isRendering ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <Share2Icon className="mr-2 h-4 w-4" />}
              {t("memo.share.image-share")}
            </Button>
          )}
          <Button onClick={handleDownload} disabled={isRendering}>
            {isRendering ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <DownloadIcon className="mr-2 h-4 w-4" />}
            {t("memo.share.image-download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemoShareImageDialog;
