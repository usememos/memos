import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema, timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { memoServiceClient } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorState } from "../state";
import { cacheService } from "./cacheService";
import { uploadService } from "./uploadService";

/**
 * Converts attachments to reference format for API requests.
 * The backend only needs the attachment name to link it to a memo.
 */
function toAttachmentReferences(attachments: Attachment[]): Attachment[] {
  return attachments.map((a) => create(AttachmentSchema, { name: a.name }));
}

/**
 * The single source of truth for the create-time memo payload. save() (NORMAL
 * create), saveDraft() and publishDraft() all build through this so a draft —
 * and a published draft — inherit every memo field identically (contract §2);
 * `overrides` carries the only deltas (`state`, and `name` when targeting an
 * existing row).
 */
function buildMemoData(state: EditorState, allAttachments: Attachment[], overrides?: { state?: State; name?: string }) {
  return create(MemoSchema, {
    content: state.content,
    visibility: state.metadata.visibility,
    attachments: toAttachmentReferences(allAttachments),
    relations: state.metadata.relations,
    location: state.metadata.location,
    createTime: state.timestamps.createTime ? timestampFromDate(state.timestamps.createTime) : undefined,
    updateTime: state.timestamps.updateTime ? timestampFromDate(state.timestamps.updateTime) : undefined,
    ...overrides,
  });
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
  if (!isEqual(allAttachments, prevMemo.attachments)) {
    mask.add("attachments");
    patch.attachments = toAttachmentReferences(allAttachments);
  }
  if (!isEqual(state.metadata.relations, prevMemo.relations)) {
    mask.add("relations");
    patch.relations = state.metadata.relations;
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

export const memoService = {
  async save(
    state: EditorState,
    options: {
      memoName?: string;
      parentMemoName?: string;
    },
  ): Promise<{ memoName: string; hasChanges: boolean }> {
    // 1. Upload local files first
    const newAttachments = await uploadService.uploadFiles(state.localFiles);
    const allAttachments = [...state.metadata.attachments, ...newAttachments];

    // 2. Update existing memo
    if (options.memoName) {
      const prevMemo = await memoServiceClient.getMemo({ name: options.memoName });
      const { mask, patch } = buildUpdateMask(prevMemo, state, allAttachments);

      if (mask.size === 0) {
        return { memoName: prevMemo.name, hasChanges: false };
      }

      const memo = await memoServiceClient.updateMemo({
        memo: create(MemoSchema, patch as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: Array.from(mask) }),
      });
      return { memoName: memo.name, hasChanges: true };
    }

    // 3. Create new memo or comment
    const memoData = buildMemoData(state, allAttachments);

    const memo = options.parentMemoName
      ? await memoServiceClient.createMemoComment({
          name: options.parentMemoName,
          comment: memoData,
        })
      : await memoServiceClient.createMemo({ memo: memoData });

    return { memoName: memo.name, hasChanges: true };
  },

  /**
   * Persist a server-side draft. Reuses save()'s exact create(MemoSchema, …)
   * builder so the draft inherits every memo field, with `state: State.DRAFT`
   * as the only delta. Unlike save(), this never gates on
   * validationService.canSave — a draft may be empty or partial (edge E4).
   */
  async saveDraft(
    state: EditorState,
    options: {
      // Set when re-saving an existing draft (resumed via the drafts list).
      draftMemoName?: string;
      // When provided, the matching localStorage keystroke buffer is cleared
      // on success so it cannot stale-restore over the server draft (edge E7).
      username?: string;
      cacheKey?: string;
    },
  ): Promise<{ memoName: string }> {
    // 1. Upload local files first (mirrors save()).
    const newAttachments = await uploadService.uploadFiles(state.localFiles);
    const allAttachments = [...state.metadata.attachments, ...newAttachments];

    // 2. Build the SAME payload as save()'s create branch, plus state: DRAFT.
    const memoData = buildMemoData(state, allAttachments, { state: State.DRAFT });

    // 3. Re-save an existing draft (updateMemo, mask incl. state held at DRAFT)
    //    or create a new one.
    let memoName: string;
    if (options.draftMemoName) {
      const memo = await memoServiceClient.updateMemo({
        memo: create(MemoSchema, { ...memoData, name: options.draftMemoName }),
        updateMask: create(FieldMaskSchema, {
          paths: ["content", "visibility", "attachments", "relations", "location", "state"],
        }),
      });
      memoName = memo.name;
    } else {
      const memo = await memoServiceClient.createMemo({ memo: memoData });
      memoName = memo.name;
    }

    // 4. Clear the localStorage keystroke buffer for this editor (edge E7).
    if (options.username !== undefined) {
      cacheService.clear(cacheService.key(options.username, options.cacheKey));
    }

    return { memoName };
  },

  /**
   * Publish a resumed draft: transition the SAME draft row DRAFT -> NORMAL via
   * updateMemo (never createMemo — that would mint a duplicate NORMAL memo and
   * orphan the draft, the exact reported bug). The "state" path in the mask
   * drives the backend publish transition (memo_service.go:549-561): created_ts
   * /updated_ts refresh + publish side-effects fire once. Reuses save()'s exact
   * payload builder so any edits made in the resumed editor are carried.
   */
  async publishDraft(state: EditorState, options: { draftMemoName: string }): Promise<{ memoName: string }> {
    const newAttachments = await uploadService.uploadFiles(state.localFiles);
    const allAttachments = [...state.metadata.attachments, ...newAttachments];

    const memoData = buildMemoData(state, allAttachments, {
      state: State.NORMAL,
      name: options.draftMemoName,
    });

    const memo = await memoServiceClient.updateMemo({
      memo: memoData,
      updateMask: create(FieldMaskSchema, {
        paths: ["content", "visibility", "attachments", "relations", "location", "state"],
      }),
    });

    return { memoName: memo.name };
  },

  /** Build editor state from an already-loaded Memo entity (no network request). */
  fromMemo(memo: Memo): EditorState {
    return {
      content: memo.content,
      metadata: {
        visibility: memo.visibility,
        attachments: memo.attachments,
        relations: memo.relations,
        location: memo.location,
      },
      ui: {
        isFocusMode: false,
        isLoading: { saving: false, uploading: false, loading: false },
        isComposing: false,
      },
      timestamps: {
        createTime: memo.createTime ? timestampDate(memo.createTime) : undefined,
        updateTime: memo.updateTime ? timestampDate(memo.updateTime) : undefined,
      },
      localFiles: [],
      audioRecorder: {
        isSupported: true,
        permission: "unknown",
        status: "idle",
        elapsedSeconds: 0,
        error: undefined,
      },
    };
  },
};
