import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExcalidrawActionError,
  type ExcalidrawFiles,
  type ExcalidrawSceneData,
  excalidrawPreviewFilename,
  findExcalidrawPreview,
  newExcalidrawFilename,
  parseExcalidrawFile,
} from "@/components/Excalidraw";
import useCurrentUser from "@/hooks/useCurrentUser";
import { showErrorToast } from "@/lib/toast";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { fetchAttachmentFile } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import { canManageAttachment } from "@/utils/user";
import { useEditorContext } from "../state";
import type { ExcalidrawSource, LocalFile } from "../types/attachment";
import { effectiveOrder } from "../utils/attachmentOrder";

type ExcalidrawTarget = { kind: "new" } | { kind: "local"; previewUrl: string } | { kind: "attachment"; name: string; canReplace: boolean };

export interface ExcalidrawSession {
  id: number;
  mode: "new" | "edit";
  filename: string;
  target: ExcalidrawTarget;
  scene?: ExcalidrawSceneData;
}

/**
 * The editor's pending files after an Excalidraw save. The source and its PNG are a pair: a
 * new drawing adds both; an edit of a draft's file swaps both in place; an edit of a saved
 * drawing becomes two pending replacements, which upload over the saved pair when the memo is
 * saved. A missing preview is added, and a pair the user can't replace is added as a copy.
 */
export const applyExcalidrawSave = (
  state: { localFiles: readonly LocalFile[]; attachments: readonly Attachment[]; order: readonly string[] },
  target: ExcalidrawTarget,
  files: { source: LocalFile; preview: LocalFile },
  canReplace: (attachment: Attachment) => boolean,
): { localFiles: LocalFile[]; order: string[] } => {
  let localFiles = [...state.localFiles];
  let order = [...effectiveOrder(state.order, state.attachments, state.localFiles)];
  const { source, preview } = files;
  const swap = (original: LocalFile, next: LocalFile) => {
    localFiles = localFiles.map((item) => (item === original ? { ...next, replaces: original.replaces } : item));
    order = order.map((key) => (key === original.previewUrl ? next.previewUrl : key));
  };
  const insertAfter = (anchor: string | undefined, keys: string[]) => {
    const position = anchor ? order.indexOf(anchor) : -1;
    if (position < 0) order.push(...keys);
    else order.splice(position + 1, 0, ...keys);
  };

  if (target.kind === "local") {
    const original = localFiles.find((item) => item.previewUrl === target.previewUrl);
    if (!original) throw new ExcalidrawActionError("editor.excalidraw.unavailable");
    const previewName = excalidrawPreviewFilename(original.file.name);
    const originalPreview = localFiles.find((item) => item !== original && item.file.name === previewName);
    swap(original, source);
    if (originalPreview) swap(originalPreview, preview);
    else {
      localFiles.push(preview);
      insertAfter(original.replaces ?? source.previewUrl, [preview.previewUrl]);
    }
    return { localFiles, order };
  }

  if (target.kind === "attachment" && target.canReplace) {
    const saved = state.attachments.find((item) => item.name === target.name);
    if (!saved) throw new ExcalidrawActionError("editor.excalidraw.unavailable");
    const savedPreview = findExcalidrawPreview(saved, state.attachments);
    const replacesPreview = savedPreview && canReplace(savedPreview) ? savedPreview.name : undefined;
    // A pending edit of the same pair gives way to this one.
    localFiles = localFiles.filter((item) => item.replaces !== saved.name && (!replacesPreview || item.replaces !== replacesPreview));
    localFiles.push({ ...source, replaces: saved.name });
    if (replacesPreview) localFiles.push({ ...preview, replaces: replacesPreview });
    else {
      const pendingPreview = localFiles.find((item) => !item.replaces && item.file.name === preview.file.name);
      if (pendingPreview) localFiles = localFiles.filter((item) => item !== pendingPreview);
      order = order.filter((key) => key !== pendingPreview?.previewUrl);
      localFiles.push(preview);
      insertAfter(saved.name, [preview.previewUrl]);
    }
    return { localFiles, order };
  }

  // A new drawing, or a copy of one the user can't replace: both files join the memo.
  localFiles.push(source, preview);
  insertAfter(target.kind === "attachment" ? target.name : undefined, [source.previewUrl, preview.previewUrl]);
  return { localFiles, order };
};

/** Excalidraw drawings join the memo's pending files; only the outer save uploads them. */
export const useExcalidraw = (toLocalFile: (file: File) => LocalFile) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { actions, dispatch, getState } = useEditorContext();
  const [session, setSession] = useState<ExcalidrawSession>();
  const [opening, setOpening] = useState<string>();
  const request = useRef<AbortController | undefined>(undefined);
  const nextId = useRef(0);

  useEffect(() => () => request.current?.abort(), []);

  const openNew = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    setOpening(undefined);
    setSession({ id: ++nextId.current, mode: "new", filename: newExcalidrawFilename(), target: { kind: "new" } });
  }, []);

  const openExisting = useCallback(
    async (source: ExcalidrawSource) => {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      const sourceId = source.kind === "local" ? source.localFile.previewUrl : source.attachment.name;
      setOpening(sourceId);
      try {
        const text =
          source.kind === "local"
            ? await source.localFile.file.text()
            : await (await fetchAttachmentFile(source.attachment, controller.signal)).text();
        const scene = parseExcalidrawFile(text);
        if (controller.signal.aborted) return;
        if (source.kind === "local") {
          setSession({
            id: ++nextId.current,
            mode: "edit",
            filename: source.localFile.file.name,
            target: { kind: "local", previewUrl: sourceId },
            scene,
          });
        } else {
          const canReplace = canManageAttachment(source.attachment, currentUser);
          setSession({
            id: ++nextId.current,
            mode: "edit",
            // A copy gets a name of its own, so its preview pairs with it and not with the original.
            filename: canReplace ? source.attachment.filename : newExcalidrawFilename(),
            target: { kind: "attachment", name: sourceId, canReplace },
            scene,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        showErrorToast(t(error instanceof ExcalidrawActionError ? error.label : "editor.excalidraw.open-failed"));
      } finally {
        if (request.current === controller) request.current = undefined;
        if (!controller.signal.aborted) setOpening(undefined);
      }
    },
    [currentUser, t],
  );

  const close = useCallback(() => setSession(undefined), []);

  const done = useCallback(
    ({ source, preview }: ExcalidrawFiles) => {
      if (!session) return;
      const state = getState();
      const next = applyExcalidrawSave(
        { localFiles: state.localFiles, attachments: state.metadata.attachments, order: state.attachmentOrder },
        session.target,
        { source: toLocalFile(source), preview: toLocalFile(preview) },
        (attachment) => canManageAttachment(attachment, currentUser),
      );
      dispatch(actions.setLocalFiles(next.localFiles));
      dispatch(actions.setAttachmentOrder(next.order));
      setSession(undefined);
    },
    [actions, currentUser, dispatch, getState, session, toLocalFile],
  );

  return { session, opening, openNew, openExisting, close, done };
};
