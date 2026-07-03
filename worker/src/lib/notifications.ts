import { create } from "@bufbuild/protobuf";
import {
  InboxMessageSchema,
  InboxMessage_MemoCommentPayloadSchema,
  InboxMessage_MemoMentionPayloadSchema,
  InboxMessage_Type,
} from "../gen/store/inbox_pb";
import { generateSnippet } from "../markdown/extract";
import { createInbox } from "../store/inbox";
import type { MemoRow } from "../store/memos";
import { getUser } from "../store/users";
import { sendEmail } from "./email";
import type { ServiceContext } from "../services/context";

// Notifies the parent memo's creator about a new comment (inbox + best-effort email).
export async function dispatchCommentNotification(ctx: ServiceContext, comment: MemoRow, parent: MemoRow): Promise<void> {
  if (comment.creator_id === parent.creator_id) {
    return;
  }
  await createInbox(
    ctx.env.DB,
    comment.creator_id,
    parent.creator_id,
    create(InboxMessageSchema, {
      type: InboxMessage_Type.MEMO_COMMENT,
      payload: {
        case: "memoComment",
        value: create(InboxMessage_MemoCommentPayloadSchema, { memoId: comment.id, relatedMemoId: parent.id }),
      },
    }),
  );
  await notifyByEmail(ctx, parent.creator_id, comment, "Новый комментарий к вашей заметке");
}

// Notifies @mentioned users (inbox + best-effort email).
export async function dispatchMentionNotifications(ctx: ServiceContext, memo: MemoRow, mentions: string[]): Promise<void> {
  for (const username of new Set(mentions)) {
    const user = await getUser(ctx.env.DB, { username });
    if (!user || user.id === memo.creator_id) {
      continue;
    }
    await createInbox(
      ctx.env.DB,
      memo.creator_id,
      user.id,
      create(InboxMessageSchema, {
        type: InboxMessage_Type.MEMO_MENTION,
        payload: {
          case: "memoMention",
          value: create(InboxMessage_MemoMentionPayloadSchema, { memoId: memo.id, relatedMemoId: memo.id }),
        },
      }),
    );
    await notifyByEmail(ctx, user.id, memo, "Вас упомянули в заметке");
  }
}

async function notifyByEmail(ctx: ServiceContext, receiverId: number, memo: MemoRow, subject: string): Promise<void> {
  try {
    const receiver = await getUser(ctx.env.DB, { id: receiverId });
    if (!receiver || !receiver.email) {
      return;
    }
    const link = ctx.env.INSTANCE_URL ? `\n\n${ctx.env.INSTANCE_URL}/memos/${memo.uid}` : "";
    await sendEmail(ctx.env, {
      to: receiver.email,
      subject,
      text: `${generateSnippet(memo.content, 200)}${link}`,
    });
  } catch (error) {
    console.warn("notification email failed:", error);
  }
}
