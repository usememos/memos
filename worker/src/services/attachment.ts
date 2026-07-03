import { create } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import {
  AttachmentSchema,
  AttachmentService,
  ListAttachmentsResponseSchema,
  type Attachment,
} from "../gen/api/v1/attachment_service_pb";
import { MotionMediaSchema as ApiMotionMediaSchema, type MotionMedia as ApiMotionMedia } from "../gen/api/v1/attachment_service_pb";
import { AttachmentPayloadSchema, MotionMediaSchema as StoreMotionMediaSchema, type MotionMedia as StoreMotionMedia } from "../gen/store/attachment_pb";
import { FilterError } from "../filter/cel";
import {
  createAttachment,
  deleteAttachment,
  getAttachment,
  listAttachments,
  updateAttachment,
  type AttachmentRow,
} from "../store/attachments";
import { getMemo, type MemoRow } from "../store/memos";
import type { ServiceContext } from "./context";
import { requireUser } from "./context";
import { tsFromUnix } from "./convert";
import { generateUid, memoUidFromName, MEMO_NAME_PREFIX } from "./memo";

export const ATTACHMENT_NAME_PREFIX = "attachments/";
const MAX_UPLOAD_BYTES = 32 << 20; // 32 MiB, same default as the Go server.

export function attachmentUidFromName(name: string): string {
  const match = /^attachments\/(.+)$/.exec(name);
  if (!match || !match[1]) {
    throw new ConnectError(`invalid attachment name: ${name}`, Code.InvalidArgument);
  }
  return match[1];
}

export function r2KeyFor(uid: string, filename: string): string {
  return `attachments/${uid}/${filename}`;
}

// MotionMedia exists in both api and store protos with identical fields but
// different type names; map fields explicitly.
function motionMediaToApi(m: StoreMotionMedia | undefined): ApiMotionMedia | undefined {
  if (!m) return undefined;
  return create(ApiMotionMediaSchema, {
    family: m.family as number,
    role: m.role as number,
    groupId: m.groupId,
    presentationTimestampUs: m.presentationTimestampUs,
    hasEmbeddedVideo: m.hasEmbeddedVideo,
  });
}

function motionMediaToStore(m: ApiMotionMedia | undefined): StoreMotionMedia | undefined {
  if (!m) return undefined;
  return create(StoreMotionMediaSchema, {
    family: m.family as number,
    role: m.role as number,
    groupId: m.groupId,
    presentationTimestampUs: m.presentationTimestampUs,
    hasEmbeddedVideo: m.hasEmbeddedVideo,
  });
}

export function convertAttachment(row: AttachmentRow, memoUid?: string | null): Attachment {
  return create(AttachmentSchema, {
    name: `${ATTACHMENT_NAME_PREFIX}${row.uid}`,
    createTime: tsFromUnix(row.created_ts),
    filename: row.filename,
    externalLink: "",
    type: row.type,
    size: BigInt(row.size),
    memo: memoUid ? `${MEMO_NAME_PREFIX}${memoUid}` : undefined,
    motionMedia: motionMediaToApi(row.payload.motionMedia),
  });
}

// Resolves memo uids for a batch of attachment rows.
export async function memoUidsFor(ctx: ServiceContext, rows: AttachmentRow[]): Promise<Map<number, string>> {
  const memoIds = [...new Set(rows.map((r) => r.memo_id).filter((id): id is number => id !== null))];
  if (memoIds.length === 0) {
    return new Map();
  }
  const result = await ctx.env.DB.prepare(`SELECT id, uid FROM memo WHERE id IN (${memoIds.map(() => "?").join(", ")})`)
    .bind(...memoIds)
    .all<{ id: number; uid: string }>();
  return new Map(result.results.map((r) => [r.id, r.uid]));
}

export function registerAttachmentService(router: ConnectRouter, ctx: ServiceContext): void {
  const db = ctx.env.DB;

  async function resolveOwnedAttachment(name: string): Promise<AttachmentRow> {
    const user = requireUser(ctx);
    const row = await getAttachment(db, { uid: attachmentUidFromName(name) });
    if (!row) {
      throw new ConnectError("attachment not found", Code.NotFound);
    }
    if (row.creator_id !== user.id && user.role !== "ADMIN") {
      throw new ConnectError("permission denied", Code.PermissionDenied);
    }
    return row;
  }

  async function removeRow(row: AttachmentRow): Promise<void> {
    await deleteAttachment(db, row.id);
    if (row.r2_key) {
      await ctx.env.BUCKET.delete(row.r2_key);
    }
  }

  router.service(AttachmentService, {
    async createAttachment(request) {
      const user = requireUser(ctx);
      const attachment = request.attachment;
      if (!attachment || attachment.filename === "") {
        throw new ConnectError("attachment filename is required", Code.InvalidArgument);
      }
      if (attachment.content.byteLength === 0) {
        throw new ConnectError("attachment content is required", Code.InvalidArgument);
      }
      if (attachment.content.byteLength > MAX_UPLOAD_BYTES) {
        throw new ConnectError(`file too large (max ${MAX_UPLOAD_BYTES >> 20} MiB)`, Code.InvalidArgument);
      }
      let memo: MemoRow | undefined;
      if (attachment.memo) {
        memo = await getMemo(db, { uid: memoUidFromName(attachment.memo) });
        if (!memo) {
          throw new ConnectError("memo not found", Code.NotFound);
        }
      }
      const uid = request.attachmentId || generateUid();
      const key = r2KeyFor(uid, attachment.filename);
      await ctx.env.BUCKET.put(key, attachment.content, {
        httpMetadata: { contentType: attachment.type || "application/octet-stream" },
      });
      const payload = create(AttachmentPayloadSchema, { motionMedia: motionMediaToStore(attachment.motionMedia) });
      const row = await createAttachment(db, {
        uid,
        creatorId: user.id,
        filename: attachment.filename,
        type: attachment.type,
        size: attachment.content.byteLength,
        memoId: memo?.id,
        r2Key: key,
        payload,
      });
      return convertAttachment(row, memo?.uid);
    },

    async listAttachments(request) {
      const user = requireUser(ctx);
      const filters: string[] = [];
      if (request.filter) {
        try {
          filters.push(request.filter);
        } catch (error) {
          if (error instanceof FilterError) {
            throw new ConnectError(`invalid filter: ${error.message}`, Code.InvalidArgument);
          }
          throw error;
        }
      }
      const pageSize = request.pageSize > 0 ? Math.min(request.pageSize, 1000) : 100;
      let offset = 0;
      if (request.pageToken) {
        const parsed = Number(request.pageToken);
        if (Number.isNaN(parsed) || parsed < 0) {
          throw new ConnectError("invalid page token", Code.InvalidArgument);
        }
        offset = parsed;
      }
      let rows: AttachmentRow[];
      try {
        rows = await listAttachments(db, { creatorId: user.id, filters, limit: pageSize + 1, offset });
      } catch (error) {
        if (error instanceof FilterError) {
          throw new ConnectError(`invalid filter: ${error.message}`, Code.InvalidArgument);
        }
        throw error;
      }
      let nextPageToken = "";
      if (rows.length > pageSize) {
        rows = rows.slice(0, pageSize);
        nextPageToken = String(offset + pageSize);
      }
      const memoUids = await memoUidsFor(ctx, rows);
      return create(ListAttachmentsResponseSchema, {
        attachments: rows.map((row) => convertAttachment(row, row.memo_id !== null ? memoUids.get(row.memo_id) : undefined)),
        nextPageToken,
        totalSize: rows.length,
      });
    },

    async getAttachment(request) {
      const row = await resolveOwnedAttachment(request.name);
      const memoUids = await memoUidsFor(ctx, [row]);
      return convertAttachment(row, row.memo_id !== null ? memoUids.get(row.memo_id) : undefined);
    },

    async updateAttachment(request) {
      if (!request.attachment || !request.updateMask || request.updateMask.paths.length === 0) {
        throw new ConnectError("attachment and update_mask are required", Code.InvalidArgument);
      }
      const row = await resolveOwnedAttachment(request.attachment.name);
      const update: Parameters<typeof updateAttachment>[1] = { id: row.id, updatedTs: Math.floor(Date.now() / 1000) };
      for (const path of request.updateMask.paths) {
        if (path === "filename") {
          update.filename = request.attachment.filename;
        } else if (path === "memo") {
          if (request.attachment.memo) {
            const memo = await getMemo(db, { uid: memoUidFromName(request.attachment.memo) });
            if (!memo) {
              throw new ConnectError("memo not found", Code.NotFound);
            }
            update.memoId = memo.id;
          } else {
            update.memoId = null;
          }
        } else {
          throw new ConnectError(`invalid update path: ${path}`, Code.InvalidArgument);
        }
      }
      await updateAttachment(db, update);
      const fresh = (await getAttachment(db, { id: row.id }))!;
      const memoUids = await memoUidsFor(ctx, [fresh]);
      return convertAttachment(fresh, fresh.memo_id !== null ? memoUids.get(fresh.memo_id) : undefined);
    },

    async deleteAttachment(request) {
      const row = await resolveOwnedAttachment(request.name);
      await removeRow(row);
      return create(EmptySchema);
    },

    async batchDeleteAttachments(request) {
      for (const name of request.names) {
        const row = await resolveOwnedAttachment(name);
        await removeRow(row);
      }
      return create(EmptySchema);
    },
  });
}
