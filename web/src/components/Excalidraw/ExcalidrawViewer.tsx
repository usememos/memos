import { useEffect, useEffectEvent, useRef, useState } from "react";
import { uploadService } from "@/components/MemoEditor/edit/services/uploadService";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { showErrorToast } from "@/lib/toast";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { fetchAttachmentFile } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment, canManageMemo } from "@/utils/user";
import ExcalidrawSheet from "./ExcalidrawSheet";
import {
  ExcalidrawActionError,
  type ExcalidrawFiles,
  type ExcalidrawSceneData,
  findExcalidrawPreview,
  newExcalidrawFilename,
  parseExcalidrawFile,
} from "./excalidraw";

export interface ExcalidrawViewerProps {
  /** The `.excalidraw` source attachment. */
  attachment: Attachment;
  memo: Pick<Memo, "name">;
  onClose: () => void;
}

/**
 * Opens a memo's Excalidraw source in the editor and saves the edit straight to the memo: the
 * source and its PNG upload over the attachments they replace, keeping their names and places.
 * An attachment the user can't replace gets a copy instead, bound to the memo after the source.
 * Uploads that finished are kept between attempts, so retrying after a failure never uploads
 * a file twice or leaves the source and the preview apart.
 */
const ExcalidrawViewer = ({ attachment, memo, onClose }: ExcalidrawViewerProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { mutateAsync: updateMemo } = useUpdateMemo(memo.name);
  const [scene, setScene] = useState<ExcalidrawSceneData>();
  // Someone else's source can't be replaced, so the edit is saved under a name of its own.
  const [filename] = useState(() => (canManageAttachment(attachment, currentUser) ? attachment.filename : newExcalidrawFilename()));
  const receipts = useRef<{ source?: Attachment; preview?: Attachment }>({});

  const failToOpen = useEffectEvent((error: unknown) => {
    showErrorToast(t(error instanceof ExcalidrawActionError ? error.label : "editor.excalidraw.open-failed"));
    onClose();
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchAttachmentFile(attachment, controller.signal)
      .then((response) => response.text())
      .then((text) => {
        if (!controller.signal.aborted) setScene(parseExcalidrawFile(text));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        failToOpen(error);
      });
    return () => controller.abort();
  }, [attachment]);

  const save = async ({ source, preview }: ExcalidrawFiles) => {
    const current = await memoServiceClient.getMemo({ name: memo.name });
    const savedSource = current.attachments.find((item) => item.name === attachment.name);
    if (!canManageMemo(current, currentUser) || !savedSource) throw new ExcalidrawActionError("editor.excalidraw.unavailable");
    const savedPreview = findExcalidrawPreview(savedSource, current.attachments);
    const replaceSource = canManageAttachment(savedSource, currentUser);
    const replacePreview = replaceSource && savedPreview !== undefined && canManageAttachment(savedPreview, currentUser);

    receipts.current.source ??= await uploadService.uploadFile({
      file: source,
      previewUrl: "",
      replaces: replaceSource ? savedSource.name : undefined,
    });
    try {
      receipts.current.preview ??= await uploadService.uploadFile({
        file: preview,
        previewUrl: "",
        replaces: replacePreview ? savedPreview.name : undefined,
      });
    } catch (error) {
      console.error(error);
      throw new ExcalidrawActionError("editor.excalidraw.preview-failed");
    }

    // Replaced files are already the memo's; new ones join it right after the source.
    const fresh = await memoServiceClient.getMemo({ name: memo.name });
    const added = [receipts.current.source, receipts.current.preview].filter(
      (item) => !fresh.attachments.some((existing) => existing.name === item.name),
    );
    try {
      if (added.length === 0) await updateMemo({ update: { name: fresh.name }, updateMask: ["update_time"] });
      else {
        const anchor = fresh.attachments.some((item) => item.name === savedSource.name);
        const attachments = anchor
          ? fresh.attachments.flatMap((item) => (item.name === savedSource.name ? [item, ...added] : [item]))
          : [...fresh.attachments, ...added];
        await updateMemo({ update: { name: fresh.name, attachments }, updateMask: ["attachments"] });
      }
    } catch (error) {
      console.error(error);
      throw new ExcalidrawActionError("editor.excalidraw.bind-failed");
    }
    receipts.current = {};
    onClose();
  };

  return <ExcalidrawSheet mode="edit" loading={!scene} initialScene={scene} filename={filename} onSave={save} onClose={onClose} />;
};

export default ExcalidrawViewer;
