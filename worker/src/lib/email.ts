import { create, fromJsonString } from "@bufbuild/protobuf";
import {
  InstanceSetting_NotificationSettingSchema,
  type InstanceSetting_NotificationSetting_EmailSetting,
} from "../gen/api/v1/instance_service_pb";
import { getInstanceSetting } from "../store/settings";
import type { Env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Loads the NOTIFICATION instance setting. The proto keeps its SMTP shape for
// frontend compatibility, but on Workers delivery goes through the Resend HTTP
// API (RESEND_API_KEY secret); only enabled/from_email/from_name are honored.
export async function getEmailSetting(db: D1Database): Promise<InstanceSetting_NotificationSetting_EmailSetting | undefined> {
  const row = await getInstanceSetting(db, "NOTIFICATION");
  if (!row) {
    return undefined;
  }
  const setting = fromJsonString(InstanceSetting_NotificationSettingSchema, row.value, { ignoreUnknownFields: true });
  return setting.email ?? undefined;
}

export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  const emailSetting = (await getEmailSetting(env.DB)) ?? create(InstanceSetting_NotificationSettingSchema).email;
  if (!emailSetting?.enabled) {
    return;
  }
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY secret is not configured");
  }
  const from = emailSetting.fromName
    ? `${emailSetting.fromName} <${emailSetting.fromEmail}>`
    : emailSetting.fromEmail;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(emailSetting.replyTo ? { reply_to: emailSetting.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`email send failed: ${response.status} ${await response.text()}`);
  }
}
