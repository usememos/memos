export type Role = "ADMIN" | "USER";
export type RowStatus = "NORMAL" | "ARCHIVED";

export interface UserRow {
  id: number;
  created_ts: number;
  updated_ts: number;
  row_status: RowStatus;
  username: string;
  role: Role;
  email: string;
  nickname: string;
  avatar_url: string;
  description: string;
}

export interface FindUser {
  id?: number;
  idList?: number[];
  username?: string;
  usernameList?: string[];
  email?: string;
  role?: Role;
  rowStatus?: RowStatus;
  search?: string;
  limit?: number;
}

export interface CreateUser {
  username: string;
  role: Role;
  email: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface UpdateUser {
  id: number;
  updatedTs?: number;
  rowStatus?: RowStatus;
  username?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  description?: string;
  role?: Role;
}

const USER_COLUMNS =
  "id, created_ts, updated_ts, row_status, username, role, email, nickname, avatar_url, description";

export async function createUser(db: D1Database, create: CreateUser): Promise<UserRow> {
  const row = await db
    .prepare(`INSERT INTO user (username, role, email, nickname, avatar_url) VALUES (?, ?, ?, ?, ?) RETURNING ${USER_COLUMNS}`)
    .bind(create.username, create.role, create.email, create.nickname ?? "", create.avatarUrl ?? "")
    .first<UserRow>();
  if (!row) {
    throw new Error("failed to create user");
  }
  return row;
}

export async function updateUser(db: D1Database, update: UpdateUser): Promise<UserRow> {
  const set: string[] = [];
  const args: unknown[] = [];
  const assign = (column: string, value: unknown) => {
    set.push(`${column} = ?`);
    args.push(value);
  };
  if (update.updatedTs !== undefined) assign("updated_ts", update.updatedTs);
  if (update.rowStatus !== undefined) assign("row_status", update.rowStatus);
  if (update.username !== undefined) assign("username", update.username);
  if (update.email !== undefined) assign("email", update.email);
  if (update.nickname !== undefined) assign("nickname", update.nickname);
  if (update.avatarUrl !== undefined) assign("avatar_url", update.avatarUrl);
  if (update.description !== undefined) assign("description", update.description);
  if (update.role !== undefined) assign("role", update.role);
  if (set.length === 0) {
    const existing = await getUser(db, { id: update.id });
    if (!existing) throw new Error(`user ${update.id} not found`);
    return existing;
  }
  args.push(update.id);
  const row = await db
    .prepare(`UPDATE user SET ${set.join(", ")} WHERE id = ? RETURNING ${USER_COLUMNS}`)
    .bind(...args)
    .first<UserRow>();
  if (!row) {
    throw new Error(`user ${update.id} not found`);
  }
  return row;
}

export async function listUsers(db: D1Database, find: FindUser = {}): Promise<UserRow[]> {
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  let orderBy = ["created_ts DESC", "row_status DESC"];

  if (find.id !== undefined) {
    where.push("id = ?");
    args.push(find.id);
  }
  if (find.idList && find.idList.length > 0) {
    where.push(`id IN (${find.idList.map(() => "?").join(", ")})`);
    args.push(...find.idList);
  }
  if (find.usernameList && find.usernameList.length > 0) {
    where.push(`username IN (${find.usernameList.map(() => "?").join(", ")})`);
    args.push(...find.usernameList);
  }
  if (find.rowStatus !== undefined) {
    where.push("row_status = ?");
    args.push(find.rowStatus);
  }
  if (find.username !== undefined) {
    where.push("username = ?");
    args.push(find.username);
  }
  if (find.role !== undefined) {
    where.push("role = ?");
    args.push(find.role);
  }
  if (find.email !== undefined) {
    where.push("email = ?");
    args.push(find.email);
  }
  if (find.search !== undefined && find.search.trim() !== "") {
    const query = find.search.trim().toLowerCase();
    where.push("(LOWER(username) LIKE ? OR LOWER(nickname) LIKE ?)");
    args.push(`%${query}%`, `%${query}%`);
    orderBy = [
      "CASE WHEN LOWER(username) = ? THEN 0 WHEN LOWER(username) LIKE ? THEN 1 WHEN LOWER(nickname) LIKE ? THEN 2 ELSE 3 END",
      "LENGTH(username) ASC",
      "created_ts DESC",
      "row_status DESC",
    ];
    args.push(query, `${query}%`, `${query}%`);
  }

  let query = `SELECT ${USER_COLUMNS} FROM user WHERE ${where.join(" AND ")} ORDER BY ${orderBy.join(", ")}`;
  if (find.limit !== undefined) {
    query += ` LIMIT ${Math.trunc(find.limit)}`;
  }
  const result = await db
    .prepare(query)
    .bind(...args)
    .all<UserRow>();
  return result.results;
}

export async function getUser(db: D1Database, find: FindUser): Promise<UserRow | undefined> {
  const rows = await listUsers(db, { ...find, limit: 1 });
  return rows[0];
}

export async function deleteUser(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM user WHERE id = ?").bind(id).run();
}
