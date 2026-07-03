import { fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { InboxMessageSchema, type InboxMessage } from "../gen/store/inbox_pb";

export type InboxStatus = "UNREAD" | "ARCHIVED";

export interface InboxRow {
  id: number;
  created_ts: number;
  sender_id: number;
  receiver_id: number;
  status: InboxStatus;
  message: InboxMessage;
}

interface RawInboxRow extends Omit<InboxRow, "message"> {
  message: string;
}

function parse(row: RawInboxRow): InboxRow {
  return { ...row, message: fromJsonString(InboxMessageSchema, row.message || "{}", { ignoreUnknownFields: true }) };
}

export async function createInbox(
  db: D1Database,
  senderId: number,
  receiverId: number,
  message: InboxMessage,
): Promise<InboxRow> {
  const row = await db
    .prepare(
      "INSERT INTO inbox (sender_id, receiver_id, status, message) VALUES (?, ?, 'UNREAD', ?) RETURNING id, created_ts, sender_id, receiver_id, status, message",
    )
    .bind(senderId, receiverId, toJsonString(InboxMessageSchema, message))
    .first<RawInboxRow>();
  if (!row) {
    throw new Error("failed to create inbox entry");
  }
  return parse(row);
}

export async function listInbox(
  db: D1Database,
  find: { receiverId?: number; id?: number; status?: InboxStatus; limit?: number; offset?: number },
): Promise<InboxRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  if (find.receiverId !== undefined) {
    where.push("receiver_id = ?");
    args.push(find.receiverId);
  }
  if (find.id !== undefined) {
    where.push("id = ?");
    args.push(find.id);
  }
  if (find.status !== undefined) {
    where.push("status = ?");
    args.push(find.status);
  }
  let query = `SELECT id, created_ts, sender_id, receiver_id, status, message FROM inbox WHERE ${where.join(" AND ")} ORDER BY created_ts DESC, id DESC`;
  if (find.limit !== undefined) {
    query += ` LIMIT ${Math.trunc(find.limit)}`;
    if (find.offset !== undefined) {
      query += ` OFFSET ${Math.trunc(find.offset)}`;
    }
  }
  const result = await db
    .prepare(query)
    .bind(...args)
    .all<RawInboxRow>();
  return result.results.map(parse);
}

export async function updateInboxStatus(db: D1Database, id: number, status: InboxStatus): Promise<void> {
  await db.prepare("UPDATE inbox SET status = ? WHERE id = ?").bind(status, id).run();
}

export async function deleteInbox(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM inbox WHERE id = ?").bind(id).run();
}
