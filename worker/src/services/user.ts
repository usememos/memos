import { create, fromJsonString, toJsonString, type DescMessage } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import {
  BatchGetUsersResponseSchema,
  GetUserWebhookSigningSecretResponseSchema,
  ListUsersResponseSchema,
  ListUserSettingsResponseSchema,
  ListUserWebhooksResponseSchema,
  UserService,
  UserSettingSchema,
  UserStatsSchema,
  UserStats_MemoTypeStatsSchema,
  UserWebhookSchema,
  ListUserNotificationsResponseSchema,
  UserNotificationSchema,
  UserNotification_MemoCommentPayloadSchema,
  UserNotification_MemoMentionPayloadSchema,
  UserNotification_Status,
  UserNotification_Type,
  type UserNotification,
  type UserWebhook,
  UserSetting_GeneralSettingSchema,
  UserSetting_TagsSettingSchema,
  UserSetting_WebhooksSettingSchema,
  User_Role,
  type UserSetting,
} from "../gen/api/v1/user_service_pb";
import {
  WebhooksUserSettingSchema,
  WebhooksUserSetting_WebhookSchema,
  type WebhooksUserSetting,
  type WebhooksUserSetting_Webhook,
} from "../gen/store/user_setting_pb";
import { generateSigningSecret } from "../lib/webhook";
import { generateSnippet } from "../markdown/extract";
import { deleteInbox, listInbox, updateInboxStatus, type InboxRow } from "../store/inbox";
import { getMemo } from "../store/memos";
import { getUserSetting, listUserSettings, upsertUserSetting } from "../store/settings";
import { getUser, listUsers, updateUser, type UpdateUser, type UserRow } from "../store/users";
import type { ServiceContext } from "./context";
import { requireUser } from "./context";
import { convertUser, rowStatusFromState, tsFromUnix, usernameFromName } from "./convert";
import { listAllUserStats } from "./user-stats";

type SettingCase = NonNullable<UserSetting["value"]["case"]>;

interface UserSettingKind {
  /** Path segment in users/{user}/settings/{setting}. */
  slug: string;
  /** Storage key in the user_setting table. */
  key: string;
  case: SettingCase;
  schema: DescMessage;
}

const USER_SETTING_KINDS: UserSettingKind[] = [
  { slug: "general", key: "GENERAL", case: "generalSetting", schema: UserSetting_GeneralSettingSchema },
  { slug: "webhooks", key: "WEBHOOKS", case: "webhooksSetting", schema: UserSetting_WebhooksSettingSchema },
  { slug: "tags", key: "TAGS", case: "tagsSetting", schema: UserSetting_TagsSettingSchema },
];

const DEFAULT_GENERAL_SETTING = { locale: "en", memoVisibility: "PRIVATE", theme: "" };

function convertWebhook(username: string, webhook: WebhooksUserSetting_Webhook): UserWebhook {
  return create(UserWebhookSchema, {
    name: `users/${username}/webhooks/${webhook.id}`,
    url: webhook.url,
    displayName: webhook.title,
    signingSecretSet: webhook.signingSecret !== "",
  });
}

async function loadOwnWebhooks(
  ctx: ServiceContext,
  parent: string,
): Promise<{ user: UserRow; setting: WebhooksUserSetting }> {
  const currentUser = requireUser(ctx);
  const username = usernameFromName(parent);
  if (username !== currentUser.username) {
    throw new ConnectError("permission denied", Code.PermissionDenied);
  }
  const row = await getUserSetting(ctx.env.DB, currentUser.id, "WEBHOOKS");
  const setting = row
    ? fromJsonString(WebhooksUserSettingSchema, row.value, { ignoreUnknownFields: true })
    : create(WebhooksUserSettingSchema);
  return { user: currentUser, setting };
}

async function saveWebhooks(ctx: ServiceContext, userId: number, setting: WebhooksUserSetting): Promise<void> {
  await upsertUserSetting(ctx.env.DB, userId, "WEBHOOKS", toJsonString(WebhooksUserSettingSchema, setting));
}

function parseNotificationName(name: string): { username: string; id: number } {
  const match = /^users\/([^/]+)\/notifications\/(\d+)$/.exec(name);
  if (!match || !match[1] || !match[2]) {
    throw new ConnectError(`invalid notification name: ${name}`, Code.InvalidArgument);
  }
  return { username: match[1], id: Number(match[2]) };
}

// Converts an inbox row to the API UserNotification, resolving memo names and
// snippets for the comment/mention payload.
async function convertNotification(ctx: ServiceContext, username: string, row: InboxRow): Promise<UserNotification> {
  const sender = await getUser(ctx.env.DB, { id: row.sender_id });
  const notification = create(UserNotificationSchema, {
    name: `users/${username}/notifications/${row.id}`,
    sender: sender ? `users/${sender.username}` : "",
    senderUser: sender ? convertUser(sender, ctx.user) : undefined,
    status: row.status === "ARCHIVED" ? UserNotification_Status.ARCHIVED : UserNotification_Status.UNREAD,
    createTime: tsFromUnix(row.created_ts),
  });
  const payload = row.message.payload;
  if (payload.case === "memoComment" || payload.case === "memoMention") {
    const memoInfo = async (memoId: number) => {
      const memo = await getMemo(ctx.env.DB, { id: memoId });
      return memo
        ? { name: `memos/${memo.uid}`, snippet: generateSnippet(memo.content, 64) }
        : { name: "", snippet: "" };
    };
    const memo = await memoInfo(payload.value.memoId);
    const related = await memoInfo(payload.value.relatedMemoId);
    const detail = {
      memo: memo.name,
      relatedMemo: related.name,
      memoSnippet: memo.snippet,
      relatedMemoSnippet: related.snippet,
    };
    if (payload.case === "memoComment") {
      notification.type = UserNotification_Type.MEMO_COMMENT;
      notification.payload = { case: "memoComment", value: create(UserNotification_MemoCommentPayloadSchema, detail) };
    } else {
      notification.type = UserNotification_Type.MEMO_MENTION;
      notification.payload = { case: "memoMention", value: create(UserNotification_MemoMentionPayloadSchema, detail) };
    }
  }
  return notification;
}

async function resolveOwnWebhook(
  ctx: ServiceContext,
  name: string,
): Promise<{ user: UserRow; setting: WebhooksUserSetting; webhook: WebhooksUserSetting_Webhook }> {
  const match = /^(users\/[^/]+)\/webhooks\/(.+)$/.exec(name);
  if (!match || !match[1] || !match[2]) {
    throw new ConnectError(`invalid webhook name: ${name}`, Code.InvalidArgument);
  }
  const { user, setting } = await loadOwnWebhooks(ctx, match[1]);
  const webhook = setting.webhooks.find((w) => w.id === match[2]);
  if (!webhook) {
    throw new ConnectError("webhook not found", Code.NotFound);
  }
  return { user, setting, webhook };
}

async function resolveUserByName(ctx: ServiceContext, name: string): Promise<UserRow> {
  const username = usernameFromName(name);
  const user = await getUser(ctx.env.DB, { username });
  if (!user) {
    throw new ConnectError("user not found", Code.NotFound);
  }
  return user;
}

function settingKindFromSlug(slug: string): UserSettingKind {
  const kind = USER_SETTING_KINDS.find((k) => k.slug === slug.toLowerCase());
  if (!kind) {
    throw new ConnectError(`unknown user setting: ${slug}`, Code.InvalidArgument);
  }
  return kind;
}

async function loadUserSetting(ctx: ServiceContext, user: UserRow, kind: UserSettingKind): Promise<UserSetting> {
  const row = await getUserSetting(ctx.env.DB, user.id, kind.key);
  let value = row ? fromJsonString(kind.schema, row.value, { ignoreUnknownFields: true }) : create(kind.schema);
  if (!row && kind.case === "generalSetting") {
    value = create(UserSetting_GeneralSettingSchema, DEFAULT_GENERAL_SETTING);
  }
  return create(UserSettingSchema, {
    name: `users/${user.username}/settings/${kind.slug}`,
    value: { case: kind.case, value } as never,
  });
}

// Collects the user's memos plus all comment descendants (even by other
// users), mirroring the recursive delete in store/db/sqlite/user_delete.go.
async function collectUserMemoIds(db: D1Database, userId: number): Promise<number[]> {
  const result = await db
    .prepare(
      `WITH RECURSIVE memo_tree(id) AS (
         SELECT id FROM memo WHERE creator_id = ?
         UNION
         SELECT mr.memo_id FROM memo_relation mr JOIN memo_tree mt ON mr.related_memo_id = mt.id AND mr.type = 'COMMENT'
       )
       SELECT id FROM memo_tree`,
    )
    .bind(userId)
    .all<{ id: number }>();
  return result.results.map((r) => r.id);
}

export async function deleteUserCascade(ctx: ServiceContext, user: UserRow): Promise<void> {
  const db = ctx.env.DB;
  const memoIds = await collectUserMemoIds(db, user.id);
  const idList = memoIds.join(", ");

  // Collect R2 keys before deleting the rows.
  const attachmentRows = await db
    .prepare(
      `SELECT r2_key FROM attachment WHERE creator_id = ?${memoIds.length > 0 ? ` OR memo_id IN (${idList})` : ""}`,
    )
    .bind(user.id)
    .all<{ r2_key: string }>();

  const statements = [
    db.prepare(`DELETE FROM attachment WHERE creator_id = ?${memoIds.length > 0 ? ` OR memo_id IN (${idList})` : ""}`).bind(user.id),
    db.prepare("DELETE FROM reaction WHERE creator_id = ?").bind(user.id),
    db.prepare("DELETE FROM user_setting WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM inbox WHERE sender_id = ? OR receiver_id = ?").bind(user.id, user.id),
    db.prepare("DELETE FROM user WHERE id = ?").bind(user.id),
  ];
  if (memoIds.length > 0) {
    statements.unshift(
      db.prepare(`DELETE FROM memo WHERE id IN (${idList})`),
      db.prepare(`DELETE FROM memo_relation WHERE memo_id IN (${idList}) OR related_memo_id IN (${idList})`),
      db.prepare(`DELETE FROM memo_share WHERE memo_id IN (${idList})`),
      db.prepare(`DELETE FROM reaction WHERE content_id IN (SELECT uid FROM memo WHERE id IN (${idList}))`),
    );
  }
  await db.batch(statements);

  const keys = attachmentRows.results.map((r) => r.r2_key).filter((k) => k !== "");
  if (keys.length > 0) {
    await ctx.env.BUCKET.delete(keys);
  }
}

export function registerUserService(router: ConnectRouter, ctx: ServiceContext): void {
  router.service(UserService, {
    async listUsers() {
      const currentUser = requireUser(ctx);
      if (currentUser.role !== "ADMIN") {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const users = await listUsers(ctx.env.DB);
      return create(ListUsersResponseSchema, {
        users: users.map((u) => convertUser(u, currentUser)),
        totalSize: users.length,
      });
    },

    async batchGetUsers(request) {
      const usernames = [...new Set(request.usernames.map((u) => u.trim()).filter((u) => u !== ""))];
      if (usernames.length === 0) {
        return create(BatchGetUsersResponseSchema, { users: [] });
      }
      const users = await listUsers(ctx.env.DB, { usernameList: usernames });
      return create(BatchGetUsersResponseSchema, {
        users: users.map((u) => convertUser(u, ctx.user)),
      });
    },

    async getUser(request) {
      const user = await resolveUserByName(ctx, request.name);
      return convertUser(user, ctx.user);
    },

    createUser() {
      throw new ConnectError("users are provisioned automatically via Cloudflare Access", Code.Unimplemented);
    },

    async updateUser(request) {
      const currentUser = requireUser(ctx);
      if (!request.user || !request.updateMask || request.updateMask.paths.length === 0) {
        throw new ConnectError("user and update_mask are required", Code.InvalidArgument);
      }
      const target = await resolveUserByName(ctx, request.user.name);
      if (currentUser.id !== target.id && currentUser.role !== "ADMIN") {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const update: UpdateUser = { id: target.id, updatedTs: Math.floor(Date.now() / 1000) };
      for (const path of request.updateMask.paths) {
        switch (path) {
          case "username": {
            if (!/^[a-z0-9]([a-z0-9-_]{1,30}[a-z0-9])$/.test(request.user.username)) {
              throw new ConnectError(`invalid username: ${request.user.username}`, Code.InvalidArgument);
            }
            update.username = request.user.username;
            break;
          }
          case "display_name":
            update.nickname = request.user.displayName;
            break;
          case "email":
            update.email = request.user.email;
            break;
          case "avatar_url": {
            const avatar = request.user.avatarUrl;
            if (avatar !== "" && !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(avatar)) {
              throw new ConnectError("invalid avatar format", Code.InvalidArgument);
            }
            update.avatarUrl = avatar;
            break;
          }
          case "description":
            update.description = request.user.description;
            break;
          case "role":
            if (currentUser.role !== "ADMIN") {
              throw new ConnectError("permission denied", Code.PermissionDenied);
            }
            update.role = request.user.role === User_Role.ADMIN ? "ADMIN" : "USER";
            break;
          case "state":
            if (currentUser.role !== "ADMIN") {
              throw new ConnectError("permission denied", Code.PermissionDenied);
            }
            update.rowStatus = rowStatusFromState(request.user.state);
            break;
          case "password":
            throw new ConnectError("passwords are handled by Cloudflare Access", Code.InvalidArgument);
          default:
            throw new ConnectError(`invalid update path: ${path}`, Code.InvalidArgument);
        }
      }
      const updated = await updateUser(ctx.env.DB, update);
      return convertUser(updated, currentUser);
    },

    async deleteUser(request) {
      const currentUser = requireUser(ctx);
      const target = await resolveUserByName(ctx, request.name);
      if (currentUser.id !== target.id && currentUser.role !== "ADMIN") {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      await deleteUserCascade(ctx, target);
      return create(EmptySchema);
    },

    async getUserSetting(request) {
      const currentUser = requireUser(ctx);
      const match = /^(users\/[^/]+)\/settings\/([^/]+)$/.exec(request.name);
      if (!match || !match[1] || !match[2]) {
        throw new ConnectError(`invalid setting name: ${request.name}`, Code.InvalidArgument);
      }
      const user = await resolveUserByName(ctx, match[1]);
      if (currentUser.id !== user.id) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      return loadUserSetting(ctx, user, settingKindFromSlug(match[2]));
    },

    async updateUserSetting(request) {
      const currentUser = requireUser(ctx);
      const setting = request.setting;
      if (!setting || setting.value.case === undefined) {
        throw new ConnectError("setting is required", Code.InvalidArgument);
      }
      if (!request.updateMask || request.updateMask.paths.length === 0) {
        throw new ConnectError("update mask is empty", Code.InvalidArgument);
      }
      const match = /^(users\/[^/]+)\/settings\/([^/]+)$/.exec(setting.name);
      if (!match || !match[1] || !match[2]) {
        throw new ConnectError(`invalid setting name: ${setting.name}`, Code.InvalidArgument);
      }
      const user = await resolveUserByName(ctx, match[1]);
      if (currentUser.id !== user.id) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const kind = settingKindFromSlug(match[2]);
      if (kind.case !== setting.value.case) {
        throw new ConnectError("setting value does not match setting name", Code.InvalidArgument);
      }
      // Merge on top of the stored value, honoring the update mask for GENERAL
      // (other kinds are replaced wholesale, matching the Go implementation).
      let next = setting.value.value;
      if (kind.case === "generalSetting") {
        const existing = await loadUserSetting(ctx, user, kind);
        const merged = create(UserSetting_GeneralSettingSchema, existing.value.value as never);
        const incoming = setting.value.value as typeof merged;
        for (const path of request.updateMask.paths) {
          if (path === "locale") merged.locale = incoming.locale;
          else if (path === "memo_visibility") merged.memoVisibility = incoming.memoVisibility;
          else if (path === "theme") merged.theme = incoming.theme;
        }
        next = merged;
      }
      await upsertUserSetting(ctx.env.DB, user.id, kind.key, toJsonString(kind.schema, next as never));
      return loadUserSetting(ctx, user, kind);
    },

    async listUserSettings(request) {
      const currentUser = requireUser(ctx);
      const user = await resolveUserByName(ctx, request.parent);
      if (currentUser.id !== user.id) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const rows = await listUserSettings(ctx.env.DB, user.id);
      const settings: UserSetting[] = [];
      for (const kind of USER_SETTING_KINDS) {
        if (kind.case === "generalSetting" || rows.some((r) => r.key === kind.key)) {
          settings.push(await loadUserSetting(ctx, user, kind));
        }
      }
      return create(ListUserSettingsResponseSchema, { settings, totalSize: settings.length });
    },

    // Personal access tokens and linked identities are superseded by
    // Cloudflare Access (service tokens / IdP config live in Zero Trust).
    listPersonalAccessTokens() {
      throw new ConnectError("use Cloudflare Access service tokens", Code.Unimplemented);
    },
    createPersonalAccessToken() {
      throw new ConnectError("use Cloudflare Access service tokens", Code.Unimplemented);
    },
    deletePersonalAccessToken() {
      throw new ConnectError("use Cloudflare Access service tokens", Code.Unimplemented);
    },
    listLinkedIdentities() {
      throw new ConnectError("identities are managed by Cloudflare Access", Code.Unimplemented);
    },
    createLinkedIdentity() {
      throw new ConnectError("identities are managed by Cloudflare Access", Code.Unimplemented);
    },
    getLinkedIdentity() {
      throw new ConnectError("identities are managed by Cloudflare Access", Code.Unimplemented);
    },
    deleteLinkedIdentity() {
      throw new ConnectError("identities are managed by Cloudflare Access", Code.Unimplemented);
    },

    async getUserStats(request) {
      const user = await resolveUserByName(ctx, request.name);
      const response = await listAllUserStats(ctx, { creatorId: user.id });
      return (
        response.stats[0] ??
        create(UserStatsSchema, {
          name: `users/${user.username}/stats`,
          tagCount: {},
          memoTypeStats: create(UserStats_MemoTypeStatsSchema),
        })
      );
    },
    async listAllUserStats(request) {
      return listAllUserStats(ctx, { state: request.state, filter: request.filter || undefined });
    },

    async listUserWebhooks(request) {
      const { user, setting } = await loadOwnWebhooks(ctx, request.parent);
      return create(ListUserWebhooksResponseSchema, {
        webhooks: setting.webhooks.map((w) => convertWebhook(user.username, w)),
      });
    },

    async createUserWebhook(request) {
      const { user, setting } = await loadOwnWebhooks(ctx, request.parent);
      if (!request.webhook || request.webhook.url === "") {
        throw new ConnectError("webhook url is required", Code.InvalidArgument);
      }
      const webhook = create(WebhooksUserSetting_WebhookSchema, {
        id: crypto.randomUUID(),
        title: request.webhook.displayName,
        url: request.webhook.url,
        signingSecret: generateSigningSecret(),
      });
      setting.webhooks.push(webhook);
      await saveWebhooks(ctx, user.id, setting);
      return convertWebhook(user.username, webhook);
    },

    async updateUserWebhook(request) {
      if (!request.webhook) {
        throw new ConnectError("webhook is required", Code.InvalidArgument);
      }
      const { user, setting, webhook } = await resolveOwnWebhook(ctx, request.webhook.name);
      const paths = request.updateMask?.paths ?? ["url", "display_name"];
      for (const path of paths) {
        if (path === "url") {
          webhook.url = request.webhook.url;
        } else if (path === "display_name") {
          webhook.title = request.webhook.displayName;
        }
      }
      await saveWebhooks(ctx, user.id, setting);
      return convertWebhook(user.username, webhook);
    },

    async deleteUserWebhook(request) {
      const { user, setting, webhook } = await resolveOwnWebhook(ctx, request.name);
      setting.webhooks = setting.webhooks.filter((w) => w.id !== webhook.id);
      await saveWebhooks(ctx, user.id, setting);
      return create(EmptySchema);
    },

    async getUserWebhookSigningSecret(request) {
      const { webhook } = await resolveOwnWebhook(ctx, request.name);
      return create(GetUserWebhookSigningSecretResponseSchema, { signingSecret: webhook.signingSecret });
    },
    async listUserNotifications(request) {
      const currentUser = requireUser(ctx);
      const user = await resolveUserByName(ctx, request.parent);
      if (currentUser.id !== user.id) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const pageSize = request.pageSize > 0 ? Math.min(request.pageSize, 1000) : 100;
      const offset = request.pageToken ? Number(request.pageToken) || 0 : 0;
      let rows = await listInbox(ctx.env.DB, { receiverId: user.id, limit: pageSize + 1, offset });
      let nextPageToken = "";
      if (rows.length > pageSize) {
        rows = rows.slice(0, pageSize);
        nextPageToken = String(offset + pageSize);
      }
      const notifications = [];
      for (const row of rows) {
        notifications.push(await convertNotification(ctx, user.username, row));
      }
      return create(ListUserNotificationsResponseSchema, { notifications, nextPageToken });
    },

    async updateUserNotification(request) {
      const currentUser = requireUser(ctx);
      if (!request.notification || !request.updateMask || request.updateMask.paths.length === 0) {
        throw new ConnectError("notification and update_mask are required", Code.InvalidArgument);
      }
      const { username, id } = parseNotificationName(request.notification.name);
      if (username !== currentUser.username) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const rows = await listInbox(ctx.env.DB, { id, receiverId: currentUser.id });
      if (rows.length === 0) {
        throw new ConnectError("notification not found", Code.NotFound);
      }
      for (const path of request.updateMask.paths) {
        if (path === "status") {
          await updateInboxStatus(
            ctx.env.DB,
            id,
            request.notification.status === UserNotification_Status.ARCHIVED ? "ARCHIVED" : "UNREAD",
          );
        }
      }
      const [updated] = await listInbox(ctx.env.DB, { id, receiverId: currentUser.id });
      return convertNotification(ctx, currentUser.username, updated!);
    },

    async deleteUserNotification(request) {
      const currentUser = requireUser(ctx);
      const { username, id } = parseNotificationName(request.name);
      if (username !== currentUser.username) {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      const rows = await listInbox(ctx.env.DB, { id, receiverId: currentUser.id });
      if (rows.length === 0) {
        throw new ConnectError("notification not found", Code.NotFound);
      }
      await deleteInbox(ctx.env.DB, id);
      return create(EmptySchema);
    },
  });
}
