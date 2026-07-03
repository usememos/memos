import { create, fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { MemoPayloadSchema, type MemoPayload } from "../gen/store/memo_pb";
import { renderFilter, MEMO_FILTER_SCHEMA } from "../filter/render";
import type { RowStatus } from "./users";

export type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";

export interface MemoRow {
  id: number;
  uid: string;
  creator_id: number;
  created_ts: number;
  updated_ts: number;
  row_status: RowStatus;
  content: string;
  visibility: Visibility;
  pinned: number;
  parent_uid: string | null;
  payload: MemoPayload;
}

interface RawMemoRow extends Omit<MemoRow, "payload"> {
  payload: string;
}

export interface FindMemo {
  id?: number;
  uid?: string;
  uidList?: string[];
  creatorId?: number;
  rowStatus?: RowStatus;
  visibilityList?: Visibility[];
  filters?: string[];
  excludeComments?: boolean;
  excludeContent?: boolean;
  orderByPinned?: boolean;
  orderByUpdatedTs?: boolean;
  orderByTimeAsc?: boolean;
  limit?: number;
  offset?: number;
}

export function parsePayload(json: string): MemoPayload {
  return fromJsonString(MemoPayloadSchema, json || "{}", { ignoreUnknownFields: true });
}

export function serializePayload(payload: MemoPayload): string {
  return toJsonString(MemoPayloadSchema, payload);
}

export function emptyPayload(): MemoPayload {
  return create(MemoPayloadSchema);
}

export interface CreateMemo {
  uid: string;
  creatorId: number;
  content: string;
  visibility: Visibility;
  payload: MemoPayload;
  createdTs?: number;
  updatedTs?: number;
}

export async function createMemo(db: D1Database, m: CreateMemo): Promise<MemoRow> {
  const fields = ["uid", "creator_id", "content", "visibility", "payload"];
  const args: unknown[] = [m.uid, m.creatorId, m.content, m.visibility, serializePayload(m.payload)];
  if (m.createdTs !== undefined) {
    fields.push("created_ts");
    args.push(m.createdTs);
  }
  if (m.updatedTs !== undefined) {
    fields.push("updated_ts");
    args.push(m.updatedTs);
  }
  const row = await db
    .prepare(
      `INSERT INTO memo (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")}) RETURNING id, created_ts, updated_ts, row_status`,
    )
    .bind(...args)
    .first<{ id: number; created_ts: number; updated_ts: number; row_status: RowStatus }>();
  if (!row) {
    throw new Error("failed to create memo");
  }
  return {
    id: row.id,
    uid: m.uid,
    creator_id: m.creatorId,
    created_ts: row.created_ts,
    updated_ts: row.updated_ts,
    row_status: row.row_status,
    content: m.content,
    visibility: m.visibility,
    pinned: 0,
    parent_uid: null,
    payload: m.payload,
  };
}

export async function listMemos(db: D1Database, find: FindMemo = {}): Promise<MemoRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];

  for (const filter of find.filters ?? []) {
    const rendered = renderFilter(filter, MEMO_FILTER_SCHEMA);
    where.push(`(${rendered.sql})`);
    args.push(...rendered.args);
  }
  if (find.id !== undefined) {
    where.push("memo.id = ?");
    args.push(find.id);
  }
  if (find.uid !== undefined) {
    where.push("memo.uid = ?");
    args.push(find.uid);
  }
  if (find.uidList && find.uidList.length > 0) {
    where.push(`memo.uid IN (${find.uidList.map(() => "?").join(", ")})`);
    args.push(...find.uidList);
  }
  if (find.creatorId !== undefined) {
    where.push("memo.creator_id = ?");
    args.push(find.creatorId);
  }
  if (find.rowStatus !== undefined) {
    where.push("memo.row_status = ?");
    args.push(find.rowStatus);
  }
  if (find.visibilityList && find.visibilityList.length > 0) {
    where.push(`memo.visibility IN (${find.visibilityList.map(() => "?").join(", ")})`);
    args.push(...find.visibilityList);
  }
  if (find.excludeComments) {
    where.push("parent_uid IS NULL");
  }

  const order = find.orderByTimeAsc ? "ASC" : "DESC";
  const orderBy: string[] = [];
  if (find.orderByPinned) {
    orderBy.push("memo.pinned DESC");
  }
  orderBy.push(find.orderByUpdatedTs ? `memo.updated_ts ${order}` : `memo.created_ts ${order}`);
  orderBy.push("memo.id DESC");

  const contentField = find.excludeContent ? "'' AS content" : "memo.content AS content";
  let query = `
    SELECT
      memo.id, memo.uid, memo.creator_id, memo.created_ts, memo.updated_ts,
      memo.row_status, memo.visibility, memo.pinned, memo.payload,
      parent_memo.uid AS parent_uid, ${contentField}
    FROM memo
    LEFT JOIN user AS memo_creator ON memo.creator_id = memo_creator.id
    LEFT JOIN memo_relation ON memo.id = memo_relation.memo_id AND memo_relation.type = 'COMMENT'
    LEFT JOIN memo AS parent_memo ON memo_relation.related_memo_id = parent_memo.id
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy.join(", ")}`;
  if (find.limit !== undefined) {
    query += ` LIMIT ${Math.trunc(find.limit)}`;
    if (find.offset !== undefined) {
      query += ` OFFSET ${Math.trunc(find.offset)}`;
    }
  }

  const result = await db
    .prepare(query)
    .bind(...args)
    .all<RawMemoRow>();
  return result.results.map((row) => ({ ...row, payload: parsePayload(row.payload) }));
}

export async function getMemo(db: D1Database, find: FindMemo): Promise<MemoRow | undefined> {
  const rows = await listMemos(db, { ...find, limit: 1 });
  return rows[0];
}

export interface UpdateMemo {
  id: number;
  uid?: string;
  createdTs?: number;
  updatedTs?: number;
  rowStatus?: RowStatus;
  content?: string;
  visibility?: Visibility;
  pinned?: boolean;
  payload?: MemoPayload;
}

export async function updateMemo(db: D1Database, update: UpdateMemo): Promise<void> {
  const set: string[] = [];
  const args: unknown[] = [];
  const assign = (column: string, value: unknown) => {
    set.push(`${column} = ?`);
    args.push(value);
  };
  if (update.uid !== undefined) assign("uid", update.uid);
  if (update.createdTs !== undefined) assign("created_ts", update.createdTs);
  if (update.updatedTs !== undefined) assign("updated_ts", update.updatedTs);
  if (update.rowStatus !== undefined) assign("row_status", update.rowStatus);
  if (update.content !== undefined) assign("content", update.content);
  if (update.visibility !== undefined) assign("visibility", update.visibility);
  if (update.pinned !== undefined) assign("pinned", update.pinned ? 1 : 0);
  if (update.payload !== undefined) assign("payload", serializePayload(update.payload));
  if (set.length === 0) {
    return;
  }
  args.push(update.id);
  await db
    .prepare(`UPDATE memo SET ${set.join(", ")} WHERE id = ?`)
    .bind(...args)
    .run();
}

// Collects a memo and all its comment descendants.
export async function collectMemoTreeIds(db: D1Database, memoId: number): Promise<number[]> {
  const result = await db
    .prepare(
      `WITH RECURSIVE memo_tree(id) AS (
         SELECT ?
         UNION
         SELECT mr.memo_id FROM memo_relation mr JOIN memo_tree mt ON mr.related_memo_id = mt.id AND mr.type = 'COMMENT'
       )
       SELECT id FROM memo_tree`,
    )
    .bind(memoId)
    .all<{ id: number }>();
  return result.results.map((r) => r.id);
}

// --- relations ---

export type RelationType = "REFERENCE" | "COMMENT";

export interface MemoRelationRow {
  memo_id: number;
  related_memo_id: number;
  type: RelationType;
}

export async function upsertMemoRelation(db: D1Database, relation: MemoRelationRow): Promise<void> {
  await db
    .prepare(
      "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES (?, ?, ?) ON CONFLICT(memo_id, related_memo_id, type) DO NOTHING",
    )
    .bind(relation.memo_id, relation.related_memo_id, relation.type)
    .run();
}

export async function listMemoRelations(
  db: D1Database,
  find: { memoId?: number; relatedMemoId?: number; memoIdList?: number[]; type?: RelationType },
): Promise<MemoRelationRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  if (find.memoId !== undefined) {
    where.push("(memo_id = ? OR related_memo_id = ?)");
    args.push(find.memoId, find.memoId);
  }
  if (find.relatedMemoId !== undefined) {
    where.push("related_memo_id = ?");
    args.push(find.relatedMemoId);
  }
  if (find.memoIdList && find.memoIdList.length > 0) {
    const placeholders = find.memoIdList.map(() => "?").join(", ");
    where.push(`(memo_id IN (${placeholders}) OR related_memo_id IN (${placeholders}))`);
    args.push(...find.memoIdList, ...find.memoIdList);
  }
  if (find.type !== undefined) {
    where.push("type = ?");
    args.push(find.type);
  }
  const result = await db
    .prepare(`SELECT memo_id, related_memo_id, type FROM memo_relation WHERE ${where.join(" AND ")}`)
    .bind(...args)
    .all<MemoRelationRow>();
  return result.results;
}

export async function deleteMemoRelations(
  db: D1Database,
  find: { memoId: number; type?: RelationType },
): Promise<void> {
  const where = ["memo_id = ?"];
  const args: unknown[] = [find.memoId];
  if (find.type !== undefined) {
    where.push("type = ?");
    args.push(find.type);
  }
  await db
    .prepare(`DELETE FROM memo_relation WHERE ${where.join(" AND ")}`)
    .bind(...args)
    .run();
}

// --- reactions ---

export interface ReactionRow {
  id: number;
  created_ts: number;
  creator_id: number;
  content_id: string;
  reaction_type: string;
}

export async function upsertReaction(db: D1Database, creatorId: number, contentId: string, reactionType: string): Promise<ReactionRow> {
  const row = await db
    .prepare(
      `INSERT INTO reaction (creator_id, content_id, reaction_type) VALUES (?, ?, ?)
       ON CONFLICT(creator_id, content_id, reaction_type) DO UPDATE SET reaction_type = EXCLUDED.reaction_type
       RETURNING id, created_ts, creator_id, content_id, reaction_type`,
    )
    .bind(creatorId, contentId, reactionType)
    .first<ReactionRow>();
  if (!row) {
    throw new Error("failed to upsert reaction");
  }
  return row;
}

export async function listReactions(db: D1Database, contentIds: string[]): Promise<ReactionRow[]> {
  if (contentIds.length === 0) {
    return [];
  }
  const result = await db
    .prepare(
      `SELECT id, created_ts, creator_id, content_id, reaction_type FROM reaction WHERE content_id IN (${contentIds.map(() => "?").join(", ")}) ORDER BY id`,
    )
    .bind(...contentIds)
    .all<ReactionRow>();
  return result.results;
}

export async function getReaction(db: D1Database, id: number): Promise<ReactionRow | undefined> {
  const row = await db
    .prepare("SELECT id, created_ts, creator_id, content_id, reaction_type FROM reaction WHERE id = ?")
    .bind(id)
    .first<ReactionRow>();
  return row ?? undefined;
}

export async function deleteReaction(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM reaction WHERE id = ?").bind(id).run();
}

// --- shares ---

export interface MemoShareRow {
  id: number;
  uid: string;
  memo_id: number;
  creator_id: number;
  created_ts: number;
  expires_ts: number | null;
}

export async function createMemoShare(db: D1Database, uid: string, memoId: number, creatorId: number, expiresTs?: number): Promise<MemoShareRow> {
  const row = await db
    .prepare(
      "INSERT INTO memo_share (uid, memo_id, creator_id, expires_ts) VALUES (?, ?, ?, ?) RETURNING id, uid, memo_id, creator_id, created_ts, expires_ts",
    )
    .bind(uid, memoId, creatorId, expiresTs ?? null)
    .first<MemoShareRow>();
  if (!row) {
    throw new Error("failed to create memo share");
  }
  return row;
}

export async function listMemoShares(db: D1Database, find: { memoId?: number; uid?: string }): Promise<MemoShareRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  if (find.memoId !== undefined) {
    where.push("memo_id = ?");
    args.push(find.memoId);
  }
  if (find.uid !== undefined) {
    where.push("uid = ?");
    args.push(find.uid);
  }
  const result = await db
    .prepare(`SELECT id, uid, memo_id, creator_id, created_ts, expires_ts FROM memo_share WHERE ${where.join(" AND ")} ORDER BY id`)
    .bind(...args)
    .all<MemoShareRow>();
  return result.results;
}

export async function deleteMemoShare(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM memo_share WHERE id = ?").bind(id).run();
}
