export interface UserSettingRow {
  user_id: number;
  key: string;
  value: string;
}

export async function upsertUserSetting(db: D1Database, userId: number, key: string, value: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO user_setting (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(userId, key, value)
    .run();
}

export async function listUserSettings(db: D1Database, userId: number, key?: string): Promise<UserSettingRow[]> {
  const where = ["user_id = ?"];
  const args: unknown[] = [userId];
  if (key !== undefined) {
    where.push("key = ?");
    args.push(key);
  }
  const result = await db
    .prepare(`SELECT user_id, key, value FROM user_setting WHERE ${where.join(" AND ")}`)
    .bind(...args)
    .all<UserSettingRow>();
  return result.results;
}

export async function getUserSetting(db: D1Database, userId: number, key: string): Promise<UserSettingRow | undefined> {
  const rows = await listUserSettings(db, userId, key);
  return rows[0];
}

export interface InstanceSettingRow {
  name: string;
  value: string;
  description: string;
}

export async function upsertInstanceSetting(db: D1Database, name: string, value: string, description = ""): Promise<void> {
  await db
    .prepare(
      "INSERT INTO system_setting (name, value, description) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description",
    )
    .bind(name, value, description)
    .run();
}

export async function getInstanceSetting(db: D1Database, name: string): Promise<InstanceSettingRow | undefined> {
  const row = await db
    .prepare("SELECT name, value, description FROM system_setting WHERE name = ?")
    .bind(name)
    .first<InstanceSettingRow>();
  return row ?? undefined;
}

export async function listInstanceSettings(db: D1Database): Promise<InstanceSettingRow[]> {
  const result = await db.prepare("SELECT name, value, description FROM system_setting").all<InstanceSettingRow>();
  return result.results;
}
