import { create, fromJsonString, toJsonString, type DescMessage, type MessageShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { EmptySchema, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { getEmailSetting } from "../lib/email";
import {
  BatchGetInstanceSettingsResponseSchema,
  InstanceService,
  InstanceProfileSchema,
  InstanceStatsSchema,
  InstanceStats_DatabaseStatsSchema,
  InstanceSettingSchema,
  InstanceSetting_AISettingSchema,
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSetting_NotificationSettingSchema,
  InstanceSetting_StorageSettingSchema,
  InstanceSetting_TagsSettingSchema,
  type InstanceSetting,
} from "../gen/api/v1/instance_service_pb";
import { getInstanceSetting, listInstanceSettings, upsertInstanceSetting } from "../store/settings";
import { getUser } from "../store/users";
import type { ServiceContext } from "./context";
import { requireAdmin } from "./context";
import { convertUser } from "./convert";

export const VERSION = "0.30.0-cf";

interface SettingKind {
  key: string;
  case: NonNullable<InstanceSetting["value"]["case"]>;
  schema: DescMessage;
  /** Settings whose stored form contains secrets that must not leak to non-admins. */
  adminOnly: boolean;
}

const SETTING_KINDS: SettingKind[] = [
  { key: "GENERAL", case: "generalSetting", schema: InstanceSetting_GeneralSettingSchema, adminOnly: false },
  { key: "STORAGE", case: "storageSetting", schema: InstanceSetting_StorageSettingSchema, adminOnly: true },
  { key: "MEMO_RELATED", case: "memoRelatedSetting", schema: InstanceSetting_MemoRelatedSettingSchema, adminOnly: false },
  { key: "TAGS", case: "tagsSetting", schema: InstanceSetting_TagsSettingSchema, adminOnly: false },
  { key: "NOTIFICATION", case: "notificationSetting", schema: InstanceSetting_NotificationSettingSchema, adminOnly: true },
  { key: "AI", case: "aiSetting", schema: InstanceSetting_AISettingSchema, adminOnly: true },
];

function kindFromName(name: string): SettingKind {
  const match = /^instance\/settings\/(.+)$/.exec(name);
  const key = match?.[1];
  const kind = SETTING_KINDS.find((k) => k.key === key);
  if (!kind) {
    throw new ConnectError(`unknown instance setting: ${name}`, Code.InvalidArgument);
  }
  return kind;
}

const DEFAULT_CONTENT_LENGTH_LIMIT = 8 * 1024;
// Matches store.DefaultReactions in the former Go server.
const DEFAULT_REACTIONS = ["👍", "👎", "❤️", "🎉", "😄", "😕", "😢", "😡"];

// Applies the same per-kind fallback defaults the Go store used to fill in
// when a setting was never written to the DB (GetInstance*Setting in
// store/instance_setting.go), so a setting is never returned "empty".
function applyDefaults(kind: SettingKind, value: MessageShape<DescMessage>): MessageShape<DescMessage> {
  if (kind.key === "MEMO_RELATED") {
    const v = value as unknown as { contentLengthLimit: number; reactions: string[] };
    if (v.contentLengthLimit < DEFAULT_CONTENT_LENGTH_LIMIT) {
      v.contentLengthLimit = DEFAULT_CONTENT_LENGTH_LIMIT;
    }
    if (v.reactions.length === 0) {
      v.reactions = [...DEFAULT_REACTIONS];
    }
  }
  return value;
}

async function loadSetting(ctx: ServiceContext, kind: SettingKind): Promise<InstanceSetting> {
  const row = await getInstanceSetting(ctx.env.DB, kind.key);
  const value: MessageShape<DescMessage> = row
    ? fromJsonString(kind.schema, row.value, { ignoreUnknownFields: true })
    : create(kind.schema);
  return create(InstanceSettingSchema, {
    name: `instance/settings/${kind.key}`,
    value: { case: kind.case, value: applyDefaults(kind, value) } as never,
  });
}

export function registerInstanceService(router: ConnectRouter, ctx: ServiceContext): void {
  router.service(InstanceService, {
    async getInstanceProfile() {
      const adminRow = await getUser(ctx.env.DB, { role: "ADMIN", rowStatus: "NORMAL" });
      return create(InstanceProfileSchema, {
        version: VERSION,
        demo: false,
        instanceUrl: ctx.env.INSTANCE_URL,
        admin: adminRow ? convertUser(adminRow, ctx.user) : undefined,
        commit: "",
        // Users are auto-provisioned from Cloudflare Access; no setup flow.
        needsSetup: false,
      });
    },

    async getInstanceSetting(request) {
      const kind = kindFromName(request.name);
      if (kind.adminOnly) {
        requireAdmin(ctx);
      }
      return loadSetting(ctx, kind);
    },

    async batchGetInstanceSettings(request) {
      const isAdmin = ctx.user?.role === "ADMIN";
      const settings: InstanceSetting[] = [];
      for (const name of request.names) {
        const kind = kindFromName(name);
        if (kind.adminOnly && !isAdmin) {
          throw new ConnectError("permission denied", Code.PermissionDenied);
        }
        settings.push(await loadSetting(ctx, kind));
      }
      return create(BatchGetInstanceSettingsResponseSchema, { settings });
    },

    async updateInstanceSetting(request) {
      requireAdmin(ctx);
      const setting = request.setting;
      if (!setting || setting.value.case === undefined) {
        throw new ConnectError("setting is required", Code.InvalidArgument);
      }
      const kind = SETTING_KINDS.find((k) => k.case === setting.value.case);
      if (!kind) {
        throw new ConnectError(`unsupported setting: ${setting.value.case}`, Code.InvalidArgument);
      }
      await upsertInstanceSetting(ctx.env.DB, kind.key, toJsonString(kind.schema, setting.value.value as never));
      return loadSetting(ctx, kind);
    },

    async testInstanceEmailSetting(request) {
      requireAdmin(ctx);
      if (!request.recipientEmail) {
        throw new ConnectError("recipient email is required", Code.InvalidArgument);
      }
      if (!ctx.env.RESEND_API_KEY) {
        throw new ConnectError("RESEND_API_KEY secret is not configured", Code.FailedPrecondition);
      }
      const emailSetting = request.email ?? (await getEmailSetting(ctx.env.DB));
      if (!emailSetting?.enabled || !emailSetting.fromEmail) {
        throw new ConnectError("email notifications are not enabled or from_email is missing", Code.FailedPrecondition);
      }
      const from = emailSetting.fromName ? `${emailSetting.fromName} <${emailSetting.fromEmail}>` : emailSetting.fromEmail;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [request.recipientEmail],
          subject: "memos: test email",
          text: "Email notifications are configured correctly.",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new ConnectError(`test email failed: ${response.status} ${await response.text()}`, Code.Internal);
      }
      return create(EmptySchema);
    },

    async getInstanceStats() {
      requireAdmin(ctx);
      const pageInfo = await ctx.env.DB.prepare(
        "SELECT (SELECT page_count FROM pragma_page_count) * (SELECT page_size FROM pragma_page_size) AS size",
      ).first<{ size: number }>();
      return create(InstanceStatsSchema, {
        database: create(InstanceStats_DatabaseStatsSchema, {
          driver: "d1",
          sizeBytes: BigInt(pageInfo?.size ?? -1),
        }),
        // No local filesystem on Workers; attachments live in R2.
        localStorageBytes: BigInt(-1),
        generatedTime: timestampFromDate(new Date()),
      });
    },
  });
}
