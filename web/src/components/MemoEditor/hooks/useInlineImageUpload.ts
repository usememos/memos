import { uniqBy } from "lodash-es";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { isImage } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import { buildManagedAttachmentMarkdown, canInlineAttachment } from "@/utils/managed-attachment";
import { errorService, uploadService } from "../services";
import { useEditorContext } from "../state";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";

interface UploadEntry {
  localFile: LocalFile;
  attachment?: Attachment;
}

interface UploadJob {
  id: string;
  entries: UploadEntry[];
  representativeIndexes: number[];
  active: boolean;
}

interface InlineLocalFileSplit {
  /** Files that become inline Markdown images; motion groups stay contiguous. */
  inline: LocalFile[];
  /** Indexes into `inline` of the file each reference is written for (the still of a motion group). */
  representativeIndexes: number[];
  /** Everything else, which stays in the attachment list. */
  attachments: LocalFile[];
}

/** Single source of truth for which picked files can be inlined and which file represents a motion group. */
export const splitInlineLocalFiles = (localFiles: LocalFile[]): InlineLocalFileSplit => {
  const inline: LocalFile[] = [];
  const representativeIndexes: number[] = [];
  const attachments: LocalFile[] = [];
  const consumedGroups = new Set<string>();

  for (const localFile of localFiles) {
    const groupID = localFile.motionMedia?.groupId;
    if (!groupID) {
      if (isImage(localFile.file.type)) {
        representativeIndexes.push(inline.length);
        inline.push(localFile);
      } else {
        attachments.push(localFile);
      }
      continue;
    }

    if (consumedGroups.has(groupID)) continue;
    consumedGroups.add(groupID);
    const group = localFiles.filter((candidate) => candidate.motionMedia?.groupId === groupID);
    const representative = group.find((candidate) => isImage(candidate.file.type));
    if (!representative) {
      attachments.push(...group);
      continue;
    }
    representativeIndexes.push(inline.length + group.indexOf(representative));
    inline.push(...group);
  }

  return { inline, representativeIndexes, attachments };
};

const createJob = (localFiles: LocalFile[]): UploadJob | undefined => {
  const { inline, representativeIndexes } = splitInlineLocalFiles(localFiles);
  if (inline.length === 0) return undefined;
  return {
    id: crypto.randomUUID(),
    entries: inline.map((localFile) => ({ localFile })),
    representativeIndexes,
    active: false,
  };
};

export const useInlineImageUpload = (editorRef: RefObject<EditorController | null>) => {
  const t = useTranslate();
  const { actions, dispatch, getState } = useEditorContext();
  const jobsRef = useRef(new Map<string, UploadJob>());
  const disposedRef = useRef(false);
  const [uploadingLocalFileURLs, setUploadingLocalFileURLs] = useState<ReadonlySet<string>>(new Set());

  /** Publishes everything derived from the live job map; call after any mutation of it. */
  const syncJobState = useCallback(() => {
    const jobs = Array.from(jobsRef.current.values());
    const state = getState();
    if (state.ui.pendingInlineImageInsertions !== jobs.length) {
      dispatch(actions.setPendingInlineImageInsertions(jobs.length));
    }
    const isUploading = jobs.some((job) => job.active);
    if (state.ui.isLoading.uploading !== isUploading) {
      dispatch(actions.setLoading("uploading", isUploading));
    }

    const uploadingURLs = new Set(
      jobs.flatMap((job) =>
        job.active ? job.entries.filter((entry) => !entry.attachment).map((entry) => entry.localFile.previewUrl) : [],
      ),
    );
    setUploadingLocalFileURLs((previous) =>
      previous.size === uploadingURLs.size && [...uploadingURLs].every((url) => previous.has(url)) ? previous : uploadingURLs,
    );
  }, [actions, dispatch, getState]);

  const appendAttachment = useCallback(
    (attachment: Attachment, localPreviewURL: string) => {
      const state = getState();
      dispatch(actions.setMetadata({ attachments: uniqBy([...state.metadata.attachments, attachment], (item) => item.name) }));
      if (state.localFiles.some((localFile) => localFile.previewUrl === localPreviewURL)) {
        dispatch(actions.removeLocalFile(localPreviewURL));
      }
    },
    [actions, dispatch, getState],
  );

  const finishJob = useCallback(
    (job: UploadJob) => {
      jobsRef.current.delete(job.id);
      syncJobState();
    },
    [syncJobState],
  );

  const dismissJob = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.active) return;
      editorRef.current?.cancelUploadAnchor(id);
      finishJob(job);
    },
    [editorRef, finishJob],
  );

  const runJobRef = useRef<(id: string) => Promise<void>>(async () => undefined);
  const retryJob = useCallback((id: string) => void runJobRef.current(id), []);

  const descriptorFor = useCallback(
    (job: UploadJob, status: "uploading" | "failed") => {
      const completed = job.entries.filter((entry) => entry.attachment).length;
      return {
        id: job.id,
        status,
        completed,
        total: job.entries.length,
        message: t(status === "uploading" ? "editor.insert-menu.uploading-images" : "editor.insert-menu.image-upload-stopped", {
          completed,
          total: job.entries.length,
        }),
        retryLabel: t("editor.insert-menu.retry-image-upload"),
        // Partially-uploaded jobs keep what landed; a job with nothing uploaded is just cancelled.
        keepLabel: t(completed > 0 ? "editor.insert-menu.keep-as-attachments" : "common.cancel"),
        onRetry: status === "failed" ? () => retryJob(job.id) : undefined,
        onKeepAttachments: status === "failed" ? () => dismissJob(job.id) : undefined,
      };
    },
    [dismissJob, retryJob, t],
  );

  const runJob = useCallback(
    async (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.active || disposedRef.current) return;
      job.active = true;
      syncJobState();
      editorRef.current?.updateUploadAnchor(descriptorFor(job, "uploading"));

      let lastError: unknown;
      for (const entry of job.entries) {
        if (entry.attachment) continue;
        try {
          entry.attachment = await uploadService.uploadFile(entry.localFile);
          if (disposedRef.current) return;
          appendAttachment(entry.attachment, entry.localFile.previewUrl);
          editorRef.current?.updateUploadAnchor(descriptorFor(job, "uploading"));
        } catch (error) {
          lastError = error;
        }
      }

      job.active = false;
      if (disposedRef.current) return;
      syncJobState();

      if (job.entries.some((entry) => !entry.attachment)) {
        editorRef.current?.updateUploadAnchor(descriptorFor(job, "failed"));
        toast.error(errorService.getErrorMessage(lastError) || t("editor.insert-menu.image-upload-failed"));
        return;
      }

      const markdown = job.representativeIndexes
        .map((index) => buildManagedAttachmentMarkdown(job.entries[index]!.attachment!))
        .join("\n\n");
      editorRef.current?.resolveUploadAnchor(job.id, markdown);
      finishJob(job);
    },
    [appendAttachment, descriptorFor, editorRef, finishJob, syncJobState, t],
  );
  runJobRef.current = runJob;

  const insertLocalImages = useCallback(
    (localFiles: LocalFile[], position?: number) => {
      if (getState().ui.isLoading.saving) return;
      const editor = editorRef.current;
      const job = createJob(localFiles);
      if (!editor || !job) return;
      jobsRef.current.set(job.id, job);
      syncJobState();
      editor.createUploadAnchor(descriptorFor(job, "uploading"), position);
      void runJob(job.id);
    },
    [descriptorFor, editorRef, getState, runJob, syncJobState],
  );

  const insertRemoteImages = useCallback(
    (attachments: Attachment[]) => {
      if (getState().ui.isLoading.saving) return;
      const markdown = attachments.filter(canInlineAttachment).map(buildManagedAttachmentMarkdown).join("\n\n");
      editorRef.current?.insertMarkdown(markdown);
    },
    [editorRef, getState],
  );

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      jobsRef.current.clear();
    };
  }, []);

  return { insertLocalImages, insertRemoteImages, uploadingLocalFileURLs };
};
