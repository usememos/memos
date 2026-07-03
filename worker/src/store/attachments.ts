import { fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { AttachmentPayloadSchema, type AttachmentPayload } from "../gen/store/attachment_pb";
import { ATTACHMENT_FILTER_SCHEMA, renderFilter } from "../filter/render";

export interface AttachmentRow {
  id: number;
  uid: string;
  creator_id: number;
  created_ts: number;
  updated_ts: number;
  filename: string;
  type: string;
  size: number;
  memo_id: number | null;
  r2_key: string;
  payload: AttachmentPayload;
}

interface RawAttachmentRow extends Omit<AttachmentRow, "payload"> {
  payload: string;
}

export function parseAttachmentPayload(json: string): AttachmentPayload {
  return fromJsonString(AttachmentPayloadSchema, json || "{}", { ignoreUnknownFields: true });
}

const COLUMNS = "attachment.id, attachment.uid, attachment.creator_id, attachment.created_ts, attachment.updated_ts, attachment.filename, attachment.type, attachment.size, attachment.memo_id, attachment.r2_key, attachment.payload";

export interface CreateAttachment {
  uid: string;
  creatorId: number;
  filename: string;
  type: string;
  size: number;
  memoId?: number;
  r2Key: string;
  payload: AttachmentPayload;
}

export async function createAttachment(db: D1Database, a: CreateAttachment): Promise<AttachmentRow> {
  const row = await db
    .prepare(
      `INSERT INTO attachment (uid, creator_id, filename, type, size, memo_id, r2_key, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS.replaceAll("attachment.", "")}`,
    )
    .bind(
      a.uid,
      a.creatorId,
      a.filename,
      a.type,
      a.size,
      a.memoId ?? null,
      a.r2Key,
      toJsonString(AttachmentPayloadSchema, a.payload),
    )
    .first<RawAttachmentRow>();
  if (!row) {
    throw new Error("failed to create attachment");
  }
  return { ...row, payload: parseAttachmentPayload(row.payload) };
}

export interface FindAttachment {
  id?: number;
  uid?: string;
  creatorId?: number;
  memoId?: number;
  memoIdList?: number[];
  filters?: string[];
  hasMemo?: boolean;
  limit?: number;
  offset?: number;
}

export async function listAttachments(db: D1Database, find: FindAttachment = {}): Promise<AttachmentRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  for (const filter of find.filters ?? []) {
    const rendered = renderFilter(filter, ATTACHMENT_FILTER_SCHEMA);
    where.push(`(${rendered.sql})`);
    args.push(...rendered.args);
  }
  if (find.id !== undefined) {
    where.push("attachment.id = ?");
    args.push(find.id);
  }
  if (find.uid !== undefined) {
    where.push("attachment.uid = ?");
    args.push(find.uid);
  }
  if (find.creatorId !== undefined) {
    where.push("attachment.creator_id = ?");
    args.push(find.creatorId);
  }
  if (find.memoId !== undefined) {
    where.push("attachment.memo_id = ?");
    args.push(find.memoId);
  }
  if (find.memoIdList && find.memoIdList.length > 0) {
    where.push(`attachment.memo_id IN (${find.memoIdList.map(() => "?").join(", ")})`);
    args.push(...find.memoIdList);
  }
  let query = `SELECT ${COLUMNS} FROM attachment WHERE ${where.join(" AND ")} ORDER BY attachment.created_ts DESC, attachment.id DESC`;
  if (find.limit !== undefined) {
    query += ` LIMIT ${Math.trunc(find.limit)}`;
    if (find.offset !== undefined) {
      query += ` OFFSET ${Math.trunc(find.offset)}`;
    }
  }
  const result = await db
    .prepare(query)
    .bind(...args)
    .all<RawAttachmentRow>();
  return result.results.map((row) => ({ ...row, payload: parseAttachmentPayload(row.payload) }));
}

export async function getAttachment(db: D1Database, find: FindAttachment): Promise<AttachmentRow | undefined> {
  const rows = await listAttachments(db, { ...find, limit: 1 });
  return rows[0];
}

export async function updateAttachment(
  db: D1Database,
  update: { id: number; filename?: string; memoId?: number | null; updatedTs?: number },
): Promise<void> {
  const set: string[] = [];
  const args: unknown[] = [];
  if (update.filename !== undefined) {
    set.push("filename = ?");
    args.push(update.filename);
  }
  if (update.memoId !== undefined) {
    set.push("memo_id = ?");
    args.push(update.memoId);
  }
  if (update.updatedTs !== undefined) {
    set.push("updated_ts = ?");
    args.push(update.updatedTs);
  }
  if (set.length === 0) {
    return;
  }
  args.push(update.id);
  await db
    .prepare(`UPDATE attachment SET ${set.join(", ")} WHERE id = ?`)
    .bind(...args)
    .run();
}

export async function deleteAttachment(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM attachment WHERE id = ?").bind(id).run();
}
