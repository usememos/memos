import { create } from "@bufbuild/protobuf";
import { toast } from "react-hot-toast";
import { memoServiceClient } from "@/connect";
import {
  type AIAssistantProfile,
  buildAICommentContent,
  clampContextCount,
  loadAIAssistantConfig,
  pickAssistant,
  requestAnalysis,
} from "@/lib/ai-assistant";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { useTranslate } from "@/utils/i18n";

type Translate = ReturnType<typeof useTranslate>;

/** Keep reference notes to real cards: not the new one, not comments, not empty. */
const pickContextContents = (memos: Memo[], excludeName: string, count: number): string[] =>
  memos
    .filter((memo) => memo.name !== excludeName && !memo.parent && memo.content.trim())
    .slice(0, count)
    .map((memo) => memo.content);

const gatherContext = async (assistant: AIAssistantProfile, newMemo: Memo): Promise<string[]> => {
  if (assistant.contextScope === "self") return [];

  const count = clampContextCount(assistant.contextCount);
  // A handful extra so filtering out the new card and comments never starves the list.
  const pageSize = count + 5;

  if (assistant.contextScope === "recent") {
    const { memos } = await memoServiceClient.listMemos({ pageSize, orderBy: "create_time desc" });
    return pickContextContents(memos, newMemo.name, count);
  }

  // scope === "tag"：标签助手用它自己的匹配标签，默认助手用新卡片的第一个标签。
  const tag = assistant.matchTag || newMemo.tags?.[0];
  if (!tag) return [];
  const escapedTag = tag.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const { memos } = await memoServiceClient.listMemos({
    pageSize,
    orderBy: "create_time desc",
    filter: `tag in ["${escapedTag}"]`,
  });
  return pickContextContents(memos, newMemo.name, count);
};

/**
 * Fire-and-forget after a new card is saved: route it to the matching assistant
 * (tag assistants first, default assistant as fallback), analyze it with the user's
 * own AI, and attach the result as a private comment signed with the assistant's name.
 * Errors surface only as a toast and never disturb the saved card.
 */
export const analyzeNewMemo = async (memoName: string, content: string, t: Translate, onCommented?: () => void): Promise<void> => {
  const config = loadAIAssistantConfig();

  try {
    // 标签是服务端保存时提取的，读回来做路由，比前端自己解析可靠。
    const newMemo = await memoServiceClient.getMemo({ name: memoName });
    const assistant = pickAssistant(config, newMemo.tags ?? []);
    if (!assistant) return;

    const displayName = assistant.name.trim() || t("setting.ai-assistant.default-name");
    const prompt = assistant.prompt.trim() || t("setting.ai-assistant.default-prompt");
    const context = await gatherContext(assistant, newMemo);
    const analysis = await requestAnalysis(config, prompt, content, context);
    await memoServiceClient.createMemoComment({
      name: memoName,
      comment: create(MemoSchema, {
        content: buildAICommentContent(displayName, analysis),
        visibility: Visibility.PRIVATE,
      }),
    });
    toast.success(t("setting.ai-assistant.analyzed"));
    onCommented?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(t("setting.ai-assistant.analyze-failed", { message }));
  }
};
