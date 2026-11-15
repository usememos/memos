import type { Scene } from "@usememos/canvas";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDrawingFile, readDrawing } from "@/components/DrawingSheet";
import useCurrentUser from "@/hooks/useCurrentUser";
import { showErrorToast } from "@/lib/toast";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment } from "@/utils/user";
import { useEditorContext } from "../state";
import type { DrawingSource, LocalFile } from "../types/attachment";

/**
 * Where the finished drawing goes: a new file in the draft, or in place of the one being
 * edited. A saved drawing the user may not replace (someone else uploaded it) stays, and
 * the edit is added as a new attachment.
 */
type DrawingTarget = { kind: "new" } | { kind: "local"; previewUrl: string } | { kind: "attachment"; name: string; canReplace: boolean };

export interface DrawingSession {
  /** A new session is a new sheet, so the canvas reads its first scene again. */
  id: number;
  mode: "new" | "edit";
  target: DrawingTarget;
  scene?: Scene;
  background?: Blob;
}

/**
 * The drawing sheet's session in the editor: a new drawing from the ＋ menu, or "Edit
 * drawing" on an attachment row. Done joins the draft through the same LocalFile path
 * as a picked image, so the memo's save uploads it. An edited drawing takes the place
 * of the one it came from: a local file is swapped in the draft; a saved attachment
 * stays, and the edit is a local file that replaces its content on save (the
 * attachment keeps its name, so links to it keep working).
 */
export const useDrawing = (toLocalFile: (file: File) => LocalFile) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { actions, dispatch, getState } = useEditorContext();
  const [session, setSession] = useState<DrawingSession>();
  // The row whose drawing is being downloaded and read.
  const [opening, setOpening] = useState<string>();
  const request = useRef<AbortController | undefined>(undefined);
  const nextId = useRef(0);

  useEffect(() => () => request.current?.abort(), []);

  const openNew = useCallback(() => {
    // A drawing still downloading must not replace the new sheet when it arrives.
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
            : // No scene inside: draw on the picture as a new drawing and leave the original alone.
              { id: ++nextId.current, mode: "new", target: { kind: "new" }, background: content.background },
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
      if (target.kind === "local") {
        // A file that is itself an edit of a saved drawing stays one.
        dispatch(
          actions.setLocalFiles(
            state.localFiles.map((item) => (item.previewUrl === target.previewUrl ? { ...localFile, replaces: item.replaces } : item)),
          ),
        );
      } else if (target.kind === "attachment" && target.canReplace) {
        // The saved drawing keeps its place; its edit uploads over it when the memo is saved.
        dispatch(
          actions.setLocalFiles([
            ...state.localFiles.filter((item) => item.replaces !== target.name),
            { ...localFile, replaces: target.name },
          ]),
        );
      } else {
        // A new drawing, or an edit of one the user may not replace (someone else uploaded it,
        // and only they or an admin may remove it): the edit joins the memo beside it.
        dispatch(actions.addLocalFile(localFile));
      }
      setSession(undefined);
    },
    [actions, dispatch, getState, session, toLocalFile],
  );

  return { session, opening, openNew, openExisting, close, done };
};
