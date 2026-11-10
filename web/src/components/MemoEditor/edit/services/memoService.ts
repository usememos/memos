import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { getEditorReferenceRelations } from "@/components/MemoMetadata/Relation/relationHelpers";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";
import type { EditorState } from "../state";
import type { LocalFile } from "../types/attachment";
import { orderAttachments } from "../utils/attachmentOrder";
import { uploadService } from "./uploadService";

/**
 * Converts attachments to reference format for API requests.
 * The backend only needs the attachment name to link it to a memo.
 */
function toAttachmentReferences(attachments: Attachment[]): Attachment[] {
  return attachments.map((a) => create(AttachmentSchema, { name: a.name }));
}

/**
 * Adds uploaded attachments to the draft's. An upload that replaced an
 * attachment's content comes back under the same name and takes its place.
 */
export function mergeUploadedAttachments(attachments: Attachment[], uploaded: Attachment[]): Attachment[] {
  const byName = new Map(uploaded.map((attachment) => [attachment.name, attachment]));
  const merged = attachments.map((attachment) => byName.get(attachment.name) ?? attachment);
  const existing = new Set(attachments.map((attachment) => attachment.name));
  return [...merged, ...uploaded.filter((attachment) => !existing.has(attachment.name))];
}

function buildUpdateMask(
  prevMemo: Memo,
  state: EditorState,
  allAttachments: typeof state.metadata.attachments,
): { mask: Set<string>; patch: Partial<Memo> } {
  const mask = new Set<string>();
  const patch: Partial<Memo> = {
    name: prevMemo.name,
    content: state.content,
  };

  if (!isEqual(state.content, prevMemo.content)) {
    mask.add("content");
    patch.content = state.content;
  }
  if (!isEqual(state.metadata.visibility, prevMemo.visibility)) {
    mask.add("visibility");
    patch.visibility = state.metadata.visibility;
  }
  // Placement and audience are validated together: a move always states the
  // audience it lands with, so a Space-only audience never follows it implicitly.
  if ((state.metadata.space || undefined) !== (prevMemo.space || undefined)) {
    mask.add("space");
    mask.add("visibility");
    patch.space = state.metadata.space ?? "";
    patch.visibility = state.metadata.visibility;
  }
  if (!isEqual(allAttachments, prevMemo.attachments)) {
    mask.add("attachments");
    patch.attachments = toAttachmentReferences(allAttachments);
  }
  const previousReferenceRelations = getEditorReferenceRelations(prevMemo.relations, prevMemo.name);
  const nextReferenceRelations = getEditorReferenceRelations(state.metadata.relations, prevMemo.name);
  if (!isEqual(nextReferenceRelations, previousReferenceRelations)) {
    mask.add("relations");
    patch.relations = nextReferenceRelations;
  }
  if (!isEqual(state.metadata.location, prevMemo.location)) {
    mask.add("location");
    patch.location = state.metadata.location;
  }

  // Auto-update timestamp if content changed
  if (["content", "attachments", "relations", "location"].some((key) => mask.has(key))) {
    mask.add("update_time");
  }

  // Handle custom timestamps
  if (state.timestamps.createTime) {
    const prevCreateTime = prevMemo.createTime ? timestampDate(prevMemo.createTime) : undefined;
    if (!isEqual(state.timestamps.createTime, prevCreateTime)) {
      mask.add("create_time");
      patch.createTime = timestampFromDate(state.timestamps.createTime);
    }
  }
  if (state.timestamps.updateTime) {
    const prevUpdateTime = prevMemo.updateTime ? timestampDate(prevMemo.updateTime) : undefined;
    if (!isEqual(state.timestamps.updateTime, prevUpdateTime)) {
      mask.add("update_time");
      patch.updateTime = timestampFromDate(state.timestamps.updateTime);
    }
  }

  return { mask, patch };
}

/**
 * The memo's own changes saved, but uploading an edited drawing over its attachment
 * failed afterwards. The edit stays in the draft, so saving again retries only it.
 */
export class DrawingNotSavedError extends Error {
  constructor(cause: unknown) {
    super("The memo was saved, but an edited drawing was not", { cause });
    this.name = "DrawingNotSavedError";
  }
}

/** The memo operations a save runs: the memo mutation hooks, so caches follow every save. */
export interface MemoSaveOperations {
  /** The memo as the server has it now, to diff the draft against. */
  getMemo: (name: string) => Promise<Memo>;
  updateMemo: (update: Partial<Memo>, updateMask: string[]) => Promise<Memo>;
  /** Creates a memo, or a comment on `parent`. */
  createMemo: (memo: Memo, parent?: string) => Promise<Memo>;
}

export const memoService = {
  async save(
    state: EditorState,
    options: {
      memoName?: string;
      parentMemoName?: string;
      space?: string;
      /** Runs as each local file finishes uploading, before the memo is saved. */
      onFileUploaded?: (localFile: LocalFile, attachment: Attachment) => void;
    },
    operations: MemoSaveOperations,
  ): Promise<{ memoName: string; hasChanges: boolean; moved?: boolean }> {
    // 1. Upload new files first. Edits of saved drawings (`replaces`) upload over
    // their attachment, which is visible at once, so they wait until the memo
    // itself is saved: a refused save then leaves every saved drawing as it was.
    const additions = state.localFiles.filter((file) => !file.replaces);
    const replacements = state.localFiles.filter((file) => file.replaces);
    const newAttachments = await uploadService.uploadFiles(additions, options.onFileUploaded);
    // New files take the places the draft gave them among the saved ones.
    const uploadedByPreviewUrl = new Map(additions.map((file, index) => [file.previewUrl, newAttachments[index]]));
    let allAttachments = orderAttachments(
      mergeUploadedAttachments(state.metadata.attachments, newAttachments),
      uploadedByPreviewUrl,
      state.attachmentOrder,
    );

    // 2. Update existing memo
    if (options.memoName) {
      const prevMemo = await operations.getMemo(options.memoName);
      const { mask, patch } = buildUpdateMask(prevMemo, state, allAttachments);

      if (mask.size === 0 && replacements.length === 0) {
        return { memoName: prevMemo.name, hasChanges: false };
      }

      let memo = mask.size > 0 ? await operations.updateMemo(patch, Array.from(mask)) : prevMemo;
      if (replacements.length > 0) {
        try {
          await uploadService.uploadFiles(replacements, options.onFileUploaded);
        } catch (error) {
          // With nothing else to save, the save simply failed; otherwise say what did land.
          throw mask.size > 0 ? new DrawingNotSavedError(error) : error;
        }
        // A new drawing is an edit of the memo: stamp it, keeping a custom time the draft sets.
        // The update returns the memo with its replaced files, which refreshes every cached copy;
        // it sends no attachment list, so one added elsewhere meanwhile stays.
        memo = await operations.updateMemo({ name: memo.name, updateTime: patch.updateTime }, ["update_time"]);
      }
      return { memoName: memo.name, hasChanges: true, moved: mask.has("space") };
    }

    // 3. Create new memo or comment. Its attachments are not visible to anyone
    // until it exists, so replacements land before it is created; a failure then
    // never leaves a created memo behind for a retry to duplicate.
    if (replacements.length > 0) {
      allAttachments = mergeUploadedAttachments(allAttachments, await uploadService.uploadFiles(replacements, options.onFileUploaded));
    }
    const memoData = create(MemoSchema, {
      content: state.content,
      visibility: state.metadata.visibility,
      attachments: toAttachmentReferences(allAttachments),
      relations: state.metadata.relations,
      location: state.metadata.location,
      createTime: state.timestamps.createTime ? timestampFromDate(state.timestamps.createTime) : undefined,
      updateTime: state.timestamps.updateTime ? timestampFromDate(state.timestamps.updateTime) : undefined,
      space: options.parentMemoName ? undefined : (options.space ?? state.metadata.space),
    });

    const memo = await operations.createMemo(memoData, options.parentMemoName);
    return { memoName: memo.name, hasChanges: true };
  },

  /**
   * Build the INIT_MEMO payload from an already-loaded Memo entity (no network
   * request). Returns only the fields the reducer's INIT_MEMO case consumes —
   * UI state (mode, loading flags, …) is owned by the reducer, not by memos.
   */
  fromMemo(memo: Memo): Pick<EditorState, "content" | "metadata" | "timestamps"> {
    return {
      content: memo.content,
      metadata: {
        visibility: memo.visibility,
        space: memo.space || undefined,
        attachments: memo.attachments,
        relations: memo.relations,
        location: memo.location,
      },
      timestamps: {
        createTime: memo.createTime ? timestampDate(memo.createTime) : undefined,
        updateTime: memo.updateTime ? timestampDate(memo.updateTime) : undefined,
      },
    };
  },
};
