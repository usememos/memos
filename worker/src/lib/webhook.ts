import { toJson } from "@bufbuild/protobuf";
import { MemoSchema, type Memo } from "../gen/api/v1/memo_service_pb";
import { WebhooksUserSettingSchema, type WebhooksUserSetting_Webhook } from "../gen/store/user_setting_pb";
import { fromJsonString } from "@bufbuild/protobuf";
import { getUserSetting } from "../store/settings";

const DISPATCH_TIMEOUT_MS = 30_000;

export async function listUserWebhooks(db: D1Database, userId: number): Promise<WebhooksUserSetting_Webhook[]> {
  const row = await getUserSetting(db, userId, "WEBHOOKS");
  if (!row) {
    return [];
  }
  return fromJsonString(WebhooksUserSettingSchema, row.value, { ignoreUnknownFields: true }).webhooks;
}

// Standard Webhooks HMAC-SHA256 signature: v1,base64(hmac(secret, "id.timestamp.payload")).
async function signPayload(secret: string, id: string, timestamp: number, payload: string): Promise<string> {
  const rawSecret = secret.startsWith("whsec_") ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0)) : new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", rawSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export function generateSigningSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${btoa(String.fromCharCode(...bytes))}`;
}

// Dispatches memo lifecycle webhooks for the memo creator. Runs inside
// ctx.waitUntil — failures are logged, never surfaced to the caller.
export async function dispatchMemoWebhooks(
  db: D1Database,
  activityType: "memos.memo.created" | "memos.memo.updated" | "memos.memo.deleted",
  memo: Memo,
  creatorId: number,
): Promise<void> {
  const webhooks = await listUserWebhooks(db, creatorId);
  if (webhooks.length === 0) {
    return;
  }
  const results = webhooks.map(async (webhook) => {
    const body = JSON.stringify({
      url: webhook.url,
      activityType,
      creator: memo.creator,
      memo: toJson(MemoSchema, memo),
    });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhook.signingSecret) {
      const id = `msg_${crypto.randomUUID().replaceAll("-", "")}`;
      const timestamp = Math.floor(Date.now() / 1000);
      headers["webhook-id"] = id;
      headers["webhook-timestamp"] = String(timestamp);
      headers["webhook-signature"] = await signPayload(webhook.signingSecret, id, timestamp, body);
    }
    try {
      await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });
    } catch (error) {
      console.warn(`webhook dispatch to ${webhook.url} failed:`, error);
    }
  });
  await Promise.allSettled(results);
}
