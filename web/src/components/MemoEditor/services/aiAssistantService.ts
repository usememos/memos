import { create } from "@bufbuild/protobuf";
import { toast } from "react-hot-toast";
import { memoServiceClient } from "@/connect";
import { type AIAssistantConfig, clampContextCount, isAIAssistantReady, loadAIAssistantConfig, requestAnalysis } from "@/lib/ai-assistant";
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

const gatherContext = async (config: AIAssistantConfig, newMemoName: string): Promise<string[]> => {
  if (config.contextScope === "self") return [];

  const count = clampContextCount(config.contextCount);
  // A handful extra so filtering out the new card and comments never starves the list.
  const pageSize = count + 5;

  if (config.contextScope === "recent") {
    const { memos } = await memoServiceClient.listMemos({ pageSize, orderBy: "create_time desc" });
    return pickContextContents(memos, newMemoName, count);
  }

  // scope === "tag": cards sharing the new card's first tag. The server extracts tags on
  // save, so read them back instead of parsing the content ourselves.
  const newMemo = await memoServiceClient.getMemo({ name: newMemoName });
  const firstTag = newMemo.tags?.[0];
  if (!firstTag) return [];
  const escapedTag = firstTag.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const { memos } = await memoServiceClient.listMemos({
    pageSize,
    orderBy: "create_time desc",
    filter: `tag in ["${escapedTag}"]`,
  });
  return pickContextContents(memos, newMemoName, count);
};

/**
 * Fire-and-forget after a new card is saved: analyze it with the user's own AI
 * (OpenAI-compatible) and attach the result as a private comment on the card.
 * Silently skips when the assistant is not configured; errors surface as a toast
 * and never disturb the saved card.
 */
export const analyzeNewMemo = async (memoName: string, content: string, t: Translate, onCommented?: () => void): Promise<void> => {
  const config = loadAIAssistantConfig();
  if (!isAIAssistantReady(config)) return;

  // 提示词留空时回落到当前语言的默认提示词。
  const effectiveConfig: AIAssistantConfig = { ...config, prompt: config.prompt.trim() || t("setting.ai-assistant.default-prompt") };

  try {
    const context = await gatherContext(effectiveConfig, memoName);
    const analysis = await requestAnalysis(effectiveConfig, content, context);
    await memoServiceClient.createMemoComment({
      name: memoName,
      comment: create(MemoSchema, { content: analysis, visibility: Visibility.PRIVATE }),
    });
    toast.success(t("setting.ai-assistant.analyzed"));
    onCommented?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(t("setting.ai-assistant.analyze-failed", { message }));
  }
};
