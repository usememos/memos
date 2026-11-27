import { Button, Dialog } from "@usememos/ui";
import { DownloadIcon, Share2Icon } from "lucide-react";
import { type CSSProperties, useCallback, useMemo, useRef, useState } from "react";
import { showErrorToast, toast } from "@/lib/toast";
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
      toast.add({ title: t("memo.share.image-downloaded"), type: "success" });
    } catch {
      showErrorToast(t("memo.share.image-download-failed"));
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
        showErrorToast(t("memo.share.image-share-failed"));
        return;
      }

      await navigator.share({
        files: [file],
        title: memo.content.slice(0, 60),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showErrorToast(t("memo.share.image-share-failed"));
      }
    } finally {
      setIsRendering(false);
    }
  }, [createShareBlob, memo.content, memo.name, t]);

  const supportsNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup
        // The panel is as wide as the image it previews, so the width is the dialog's own.
        style={{ "--mu-dialog-width": `${dialogWidth}px` } as CSSProperties}
        closeLabel={t("common.close")}
      >
        <Dialog.Title>{t("memo.share.image-title")}</Dialog.Title>
        <Dialog.Description>{t("memo.share.image-description", { width: previewRenderWidth })}</Dialog.Description>

        <div className="flex justify-center overflow-x-auto">
          <MemoShareImagePreview ref={previewRef} width={previewRenderWidth} />
        </div>

        <Dialog.Footer>
          {supportsNativeShare && (
            <Button
              variant="ghost"
              onClick={handleNativeShare}
              loading={isRendering}
              loadingLabel={t("memo.share.image-share")}
              icon={<Share2Icon />}
            >
              {t("memo.share.image-share")}
            </Button>
          )}
          <Button
            variant="neutral"
            onClick={handleDownload}
            loading={isRendering}
            loadingLabel={t("memo.share.image-download")}
            icon={<DownloadIcon />}
          >
            {t("memo.share.image-download")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default MemoShareImageDialog;
