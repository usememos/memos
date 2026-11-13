import type { CanvasHandle, Scene } from "@usememos/canvas";
import { Canvas } from "@usememos/canvas/react";
import { Button, Dialog, Spinner, Tooltip } from "@usememos/ui";
import { PencilLineIcon, ScanIcon, XIcon } from "lucide-react";
import { type ReactElement, useEffect, useEffectEvent, useRef, useState } from "react";
import { uploadService } from "@/components/MemoEditor/edit/services/uploadService";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment } from "@/utils/user";
import { DrawingDialogPopup, FloatingBar, FloatingRow } from "./DrawingFrame";
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
 * Zoom to fit and, for whoever may change the memo, Edit. Edit turns the viewer
 * into the drawing sheet; Done replaces the drawing's file under the same name, stamps the
 * memo's update time and returns to viewing the new version. An edit of someone else's
 * drawing is added to the memo beside it.
 */
const DrawingViewer = ({ attachment: initialAttachment, memo, canEdit, onClose, onNoScene }: DrawingViewerProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const isWide = useMediaQuery("sm");
  // Small controls on a desktop; a phone keeps the 32px ones for touch.
  const size = isWide ? "sm" : undefined;
  const { theme, fontFamily } = useCanvasTheme();
  const { mutateAsync: updateMemo } = useUpdateMemo(memo.name);
  const canvasRef = useRef<CanvasHandle>(null);
  const [attachment, setAttachment] = useState(initialAttachment);
  const [scene, setScene] = useState<Scene>();
  const [isEditing, setIsEditing] = useState(false);
  // An edit saved as a copy whose memo update failed: the user's own, so a retry replaces it
  // instead of uploading another.
  const unlinkedCopy = useRef<Attachment>(undefined);
  // The load runs once per attachment; it reports through the host's committed callbacks.
  const showNoScene = useEffectEvent(onNoScene);
  const failToOpen = useEffectEvent(() => {
    showErrorToast(t("editor.drawing.open-failed"));
    onClose();
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchDrawingFile(initialAttachment, controller.signal)
      .then(readDrawing)
      .then((content) => {
        if (controller.signal.aborted) return;
        if (content.scene) setScene(content.scene);
        else showNoScene();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        failToOpen();
      });
    return () => controller.abort();
  }, [initialAttachment]);

  // Done in the sheet: the edit replaces the drawing's file. A drawing someone else uploaded
  // stays, since only they or an admin may replace or remove it, and the edit joins the memo
  // beside it.
  const saveEdit = async (file: File) => {
    const replace = canManageAttachment(attachment, currentUser);
    const replaces = replace ? attachment.name : unlinkedCopy.current?.name;
    const saved = await uploadService.uploadFile({ file, previewUrl: "", replaces });
    if (replace) {
      await updateMemo({ update: { name: memo.name }, updateMask: ["update_time"] });
    } else {
      unlinkedCopy.current = saved;
      // Whole attachments, not names: the optimistic update shows them until the memo reloads.
      const attachments = memo.attachments.flatMap((item) => (item.name === attachment.name ? [item, saved] : [item]));
      await updateMemo({ update: { name: memo.name, attachments }, updateMask: ["attachments"] });
      unlinkedCopy.current = undefined;
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
      <DrawingDialogPopup label={title}>
        <div className="relative h-full w-full" style={{ background: theme.paper }}>
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
          <FloatingRow edge="top">
            {/* The caption matches the bar's button text: 13px beside small controls, 14px on a phone.
                Not a Dialog.Title, whose heading type is 16px; the popup's aria-label names the dialog. */}
            <FloatingBar className={isWide ? "pr-2" : "pr-3"}>
              <IconAction size={size} label={t("common.close")} icon={<XIcon />} onClick={onClose} />
              <span className={cn("truncate text-mu-text", isWide ? "mu-label-sm" : "mu-label")}>{title}</span>
            </FloatingBar>
            <FloatingBar className={isWide ? undefined : "gap-3"}>
              <IconAction
                size={size}
                label={t("editor.drawing.zoom-to-fit")}
                icon={<ScanIcon />}
                onClick={() => canvasRef.current?.zoomToFit()}
              />
              {canEdit && (
                // Flat inside the bar: the bar is the one bordered surface.
                <Button variant="ghost" size={size} icon={<PencilLineIcon />} disabled={!scene} onClick={() => setIsEditing(true)}>
                  {t("common.edit")}
                </Button>
              )}
            </FloatingBar>
          </FloatingRow>
        </div>
      </DrawingDialogPopup>
    </Dialog.Root>
  );
};

/** An icon-only ghost Button named by its Tooltip. */
const IconAction = ({ label, icon, size, onClick }: { label: string; icon: ReactElement; size?: "sm"; onClick: () => void }) => (
  <Tooltip.Root>
    <Tooltip.Trigger render={<Button variant="ghost" size={size} aria-label={label} icon={icon} onClick={onClick} />} />
    <Tooltip.Popup>{label}</Tooltip.Popup>
  </Tooltip.Root>
);

export default DrawingViewer;
