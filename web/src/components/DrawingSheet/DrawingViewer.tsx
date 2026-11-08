import { create } from "@bufbuild/protobuf";
import type { CanvasHandle, Scene } from "@usememos/canvas";
import { Canvas } from "@usememos/canvas/react";
import { Button, buttonClasses, Dialog, Spinner, Tooltip } from "@usememos/ui";
import { DownloadIcon, PencilLineIcon, ScanIcon, XIcon } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { uploadService } from "@/components/MemoEditor/edit/services/uploadService";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type Attachment, AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment } from "@/utils/user";
import DrawingSheet from "./DrawingSheet";
import { fetchDrawingFile, readDrawing } from "./drawing";
import { useCanvasTheme } from "./useCanvasTheme";

export interface DrawingViewerProps {
  attachment: Attachment;
  /** The memo the drawing belongs to; with `canEdit`, Edit saves the drawing back to it. */
  memo: Pick<Memo, "name" | "attachments">;
  /** Whether the viewer may change the memo: its author or an admin. */
  canEdit: boolean;
  onClose: () => void;
  /** The file carries no readable scene: show it as the plain image it is. */
  onNoScene: () => void;
}

/**
 * A drawing opened from a memo: the canvas in its read-only mode (pan, zoom, copy), with
 * Zoom to fit, Download and, for whoever may change the memo, Edit. Edit turns the viewer
 * into the drawing sheet; Done replaces the drawing's file under the same name, stamps the
 * memo's update time and returns to viewing the new version.
 */
const DrawingViewer = ({ attachment: initialAttachment, memo, canEdit, onClose, onNoScene }: DrawingViewerProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const isWide = useMediaQuery("sm");
  const { theme, fontFamily } = useCanvasTheme();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const canvasRef = useRef<CanvasHandle>(null);
  const [attachment, setAttachment] = useState(initialAttachment);
  const [scene, setScene] = useState<Scene>();
  const [isEditing, setIsEditing] = useState(false);
  // The load runs once per attachment; it reports through the host's latest callbacks.
  const host = useRef({ onClose, onNoScene, t });
  host.current = { onClose, onNoScene, t };

  useEffect(() => {
    const controller = new AbortController();
    fetchDrawingFile(initialAttachment, controller.signal)
      .then(readDrawing)
      .then((content) => {
        if (controller.signal.aborted) return;
        if (content.scene) setScene(content.scene);
        else host.current.onNoScene();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        showErrorToast(host.current.t("editor.drawing.open-failed"));
        host.current.onClose();
      });
    return () => controller.abort();
  }, [initialAttachment]);

  // Done in the sheet: the edit replaces the drawing's file, or, for a drawing someone else
  // uploaded (which only they or an admin may replace), takes its place as a new attachment.
  const saveEdit = async (file: File) => {
    const replace = canManageAttachment(attachment, currentUser);
    const saved = await uploadService.uploadFile({ file, previewUrl: "", replaces: replace ? attachment.name : undefined });
    if (replace) {
      await updateMemo({ update: { name: memo.name }, updateMask: ["update_time"] });
    } else {
      const attachments = memo.attachments.map((item) =>
        create(AttachmentSchema, { name: item.name === attachment.name ? saved.name : item.name }),
      );
      await updateMemo({ update: { name: memo.name, attachments }, updateMask: ["attachments"] });
    }
    const content = await readDrawing(file);
    setAttachment(saved);
    if (content.scene) setScene(content.scene);
    setIsEditing(false);
  };

  if (isEditing && scene) {
    return <DrawingSheet mode="edit" initialScene={scene} onDone={saveEdit} onClose={() => setIsEditing(false)} />;
  }

  const title = t("editor.insert-menu.drawing");
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Popup variant="bare" fullScreen aria-label={title}>
        <div className="flex h-full w-full flex-col bg-mu-surface">
          <div className="flex h-[calc(52px+env(safe-area-inset-top))] w-full shrink-0 items-center gap-2 border-b border-mu-line bg-mu-surface px-3 pt-[env(safe-area-inset-top)]">
            <IconAction label={t("common.close")} icon={<XIcon />} onClick={onClose} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="truncate mu-label text-mu-ink">{title}</Dialog.Title>
              {isWide && <span className="truncate mu-caption text-mu-ink-muted">{attachment.filename}</span>}
            </div>
            <div className={cn("flex shrink-0 items-center", isWide ? "gap-0.5" : "gap-3")}>
              <IconAction label={t("editor.drawing.zoom-to-fit")} icon={<ScanIcon />} onClick={() => canvasRef.current?.zoomToFit()} />
              {/* The original file: a plain image anywhere, editable again when opened in memos. */}
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <a
                      href={getAttachmentUrl(attachment)}
                      download={attachment.filename}
                      aria-label={t("common.download")}
                      className={buttonClasses({ variant: "ghost", iconOnly: true })}
                    >
                      <DownloadIcon className="mu-icon" />
                    </a>
                  }
                />
                <Tooltip.Popup>{t("common.download")}</Tooltip.Popup>
              </Tooltip.Root>
              {canEdit && (
                <Button variant="neutral" icon={<PencilLineIcon />} disabled={!scene} onClick={() => setIsEditing(true)}>
                  {t("common.edit")}
                </Button>
              )}
            </div>
          </div>
          <div className="relative min-h-0 flex-1" style={{ background: theme.paper }}>
            {scene ? (
              // No autofocus: a viewer should not draw a focus ring around the page as it opens.
              <Canvas
                ref={canvasRef}
                className="absolute inset-0"
                readOnly
                ariaLabel={title}
                initialScene={scene}
                theme={theme}
                fontFamily={fontFamily}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner label={t("editor.blocks.loading")} />
              </div>
            )}
          </div>
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

/** An icon-only ghost Button named by its Tooltip. */
const IconAction = ({ label, icon, onClick }: { label: string; icon: ReactElement; onClick: () => void }) => (
  <Tooltip.Root>
    <Tooltip.Trigger render={<Button variant="ghost" aria-label={label} icon={icon} onClick={onClick} />} />
    <Tooltip.Popup>{label}</Tooltip.Popup>
  </Tooltip.Root>
);

export default DrawingViewer;
