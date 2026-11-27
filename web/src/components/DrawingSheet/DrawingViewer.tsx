import type { Scene } from "@usememos/canvas";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { uploadService } from "@/components/MemoEditor/edit/services/uploadService";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { showErrorToast } from "@/lib/toast";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment, canManageMemo } from "@/utils/user";
import DrawingSheet from "./DrawingSheet";
import { DrawingActionError, fetchDrawingFile, readDrawing, sceneContent } from "./drawing";

export interface DrawingViewerProps {
  attachment: Attachment;
  memo: Pick<Memo, "name" | "attachments">;
  canEdit: boolean;
  annotate?: boolean;
  onClose: () => void;
  onNoScene: () => void;
}

const DrawingViewer = ({ attachment: initialAttachment, memo, canEdit, annotate = false, onClose, onNoScene }: DrawingViewerProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { mutateAsync: updateMemo } = useUpdateMemo(memo.name);
  const [attachment, setAttachment] = useState(initialAttachment);
  const [scene, setScene] = useState<Scene>();
  const [background, setBackground] = useState<Blob>();
  const [isEditing, setIsEditing] = useState(false);
  const [forceCopy, setForceCopy] = useState(false);
  const [submissionPending, setSubmissionPending] = useState(false);
  const receipt = useRef<Attachment>(undefined);
  const uploadedScene = useRef<Scene>(undefined);
  const baseline = useRef<string | undefined>(undefined);
  const account = useRef(currentUser?.name);
  const latestAccount = useRef(currentUser?.name);
  latestAccount.current = currentUser?.name;
  const checkAccount = () => {
    if (!currentUser || account.current !== latestAccount.current) throw new DrawingActionError("editor.drawing.unavailable");
  };
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
        if (content.scene) {
          setScene(content.scene);
          baseline.current = sceneContent(content.scene);
        } else if (annotate) {
          setBackground(content.background);
          setIsEditing(true);
        } else showNoScene();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        failToOpen();
      });
    return () => controller.abort();
  }, [initialAttachment, annotate]);

  const saveEdit = async (file: File) => {
    checkAccount();
    const current = await memoServiceClient.getMemo({ name: memo.name });
    checkAccount();
    const source = current.attachments.find((item) => item.name === attachment.name);
    if (!canEdit || !canManageMemo(current, currentUser) || !source) throw new DrawingActionError("editor.drawing.unavailable");
    const replace = !background && !forceCopy && canManageAttachment(source, currentUser);
    if (replace && !receipt.current) {
      const original = await readDrawing(await fetchDrawingFile(source));
      checkAccount();
      if (!original.scene || sceneContent(original.scene) !== baseline.current) {
        setForceCopy(true);
        throw new DrawingActionError("editor.drawing.changed-save-copy");
      }
    }
    let saved = receipt.current;
    if (!saved) {
      saved = await uploadService.uploadFile({ file, previewUrl: "", replaces: replace ? source.name : undefined });
      receipt.current = saved;
      setSubmissionPending(true);
      uploadedScene.current = (await readDrawing(file)).scene;
    }
    checkAccount();
    try {
      if (saved.name === source.name) await updateMemo({ update: { name: current.name }, updateMask: ["update_time"] });
      else {
        const fresh = await memoServiceClient.getMemo({ name: memo.name });
        checkAccount();
        if (!canManageMemo(fresh, currentUser) || !fresh.attachments.some((item) => item.name === source.name))
          throw new DrawingActionError("editor.drawing.unavailable");
        const attachments = fresh.attachments.some((item) => item.name === saved.name)
          ? fresh.attachments
          : fresh.attachments.flatMap((item) => (item.name === source.name ? [item, saved] : [item]));
        await updateMemo({ update: { name: fresh.name, attachments }, updateMask: ["attachments"] });
      }
    } catch (error) {
      if (error instanceof DrawingActionError) throw error;
      throw new DrawingActionError(saved.name === source.name ? "editor.drawing.saved-needs-update" : "editor.drawing.bind-failed");
    }
    setAttachment(saved);
    if (uploadedScene.current) {
      setScene(uploadedScene.current);
      baseline.current = sceneContent(uploadedScene.current);
    }
    setBackground(undefined);
    setSubmissionPending(false);
    receipt.current = undefined;
    setIsEditing(false);
  };

  if (account.current !== currentUser?.name) return null;
  return (
    <DrawingSheet
      mode={isEditing ? (background ? "new" : "edit") : "view"}
      loading={!scene && !background}
      onEdit={canEdit ? () => setIsEditing(true) : undefined}
      initialScene={scene}
      background={background}
      commitLabel={background || forceCopy || !canManageAttachment(attachment, currentUser) ? "editor.drawing.save-copy" : "common.save"}
      submissionPending={submissionPending}
      onDone={saveEdit}
      onDiscard={() => {
        let accepted = scene;
        if (receipt.current?.name === attachment.name && uploadedScene.current) {
          accepted = uploadedScene.current;
          setScene(uploadedScene.current);
          baseline.current = sceneContent(uploadedScene.current);
        }
        receipt.current = undefined;
        setSubmissionPending(false);
        return accepted;
      }}
      onClose={() => {
        if (!isEditing || background) onClose();
        else setIsEditing(false);
      }}
    />
  );
};

export default DrawingViewer;
