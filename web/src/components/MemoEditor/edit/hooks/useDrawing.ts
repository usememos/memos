import type { Scene } from "@usememos/canvas";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDrawingFile, readDrawing } from "@/components/DrawingSheet";
import useCurrentUser from "@/hooks/useCurrentUser";
import { showErrorToast } from "@/lib/toast";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment } from "@/utils/user";
import { useEditorContext } from "../state";
import type { DrawingSource, LocalFile } from "../types/attachment";
import { effectiveOrder } from "../utils/attachmentOrder";

type DrawingTarget =
  | { kind: "new"; after?: string }
  | { kind: "local"; previewUrl: string }
  | { kind: "attachment"; name: string; canReplace: boolean };

export interface DrawingSession {
  id: number;
  mode: "new" | "edit";
  target: DrawingTarget;
  scene?: Scene;
  background?: Blob;
}

/** Markup joins the memo's pending files; only the outer save uploads it. */
export const useDrawing = (toLocalFile: (file: File) => LocalFile) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { actions, dispatch, getState } = useEditorContext();
  const [session, setSession] = useState<DrawingSession>();
  const [opening, setOpening] = useState<string>();
  const request = useRef<AbortController | undefined>(undefined);
  const nextId = useRef(0);

  useEffect(() => () => request.current?.abort(), []);

  const openNew = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    setOpening(undefined);
    setSession({ id: ++nextId.current, mode: "new", target: { kind: "new" } });
  }, []);

  const openExisting = useCallback(
    async (source: DrawingSource) => {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      const sourceId = source.kind === "local" ? source.localFile.previewUrl : source.attachment.name;
      setOpening(sourceId);
      try {
        const file = source.kind === "local" ? source.localFile.file : await fetchDrawingFile(source.attachment, controller.signal);
        const content = await readDrawing(file);
        if (controller.signal.aborted) return;
        const target: DrawingTarget =
          source.kind === "local"
            ? { kind: "local", previewUrl: sourceId }
            : { kind: "attachment", name: sourceId, canReplace: canManageAttachment(source.attachment, currentUser) };
        setSession(
          content.scene
            ? { id: ++nextId.current, mode: "edit", target, scene: content.scene }
            : { id: ++nextId.current, mode: "new", target: { kind: "new", after: sourceId }, background: content.background },
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        showErrorToast(t("editor.drawing.open-failed"));
      } finally {
        if (request.current === controller) request.current = undefined;
        if (!controller.signal.aborted) setOpening(undefined);
      }
    },
    [currentUser, t],
  );

  const close = useCallback(() => setSession(undefined), []);
  const done = useCallback(
    (file: File) => {
      const target = session?.target ?? { kind: "new" };
      const localFile = toLocalFile(file);
      const state = getState();
      let order = [...effectiveOrder(state.attachmentOrder, state.metadata.attachments, state.localFiles)];
      if (target.kind === "local") {
        const original = state.localFiles.find((item) => item.previewUrl === target.previewUrl);
        if (!original) throw new Error("Markup removed from memo");
        dispatch(
          actions.setLocalFiles(state.localFiles.map((item) => (item === original ? { ...localFile, replaces: item.replaces } : item))),
        );
        order = order.map((key) => (key === original.previewUrl ? localFile.previewUrl : key));
      } else if (target.kind === "attachment" && target.canReplace) {
        dispatch(
          actions.setLocalFiles([
            ...state.localFiles.filter((item) => item.replaces !== target.name),
            { ...localFile, replaces: target.name },
          ]),
        );
      } else {
        const source = target.kind === "new" ? target.after : target.name;
        if (source) {
          const position = order.indexOf(source);
          if (position < 0) throw new Error("Annotation source removed from memo");
          order.splice(position + 1, 0, localFile.previewUrl);
        }
        dispatch(actions.addLocalFile(localFile));
      }
      dispatch(actions.setAttachmentOrder(order));
      setSession(undefined);
    },
    [actions, dispatch, getState, session, toLocalFile],
  );

  return { session, opening, openNew, openExisting, close, done };
};
