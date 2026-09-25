/**
 * AI 卡片助手：保存新卡片后，把内容发给 OpenAI 兼容接口分析，结果以评论形式追加到卡片。
 * 配置存在浏览器 localStorage（个人实例场景），不上传服务器，因此每个浏览器各自配置。
 */

export type AIContextScope = "self" | "recent" | "tag";

export interface AIAssistantConfig {
  enabled: boolean;
  /** OpenAI-compatible base URL, e.g. https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 分析提示词；留空时由调用方回落到当前语言的默认提示词。 */
  prompt: string;
  contextScope: AIContextScope;
  /** recent/tag 范围下参考的卡片数量。 */
  contextCount: number;
}

const STORAGE_KEY = "memos.ai-assistant-config";

export const DEFAULT_CONTEXT_COUNT = 10;
export const MAX_CONTEXT_COUNT = 50;
/** Keeps the request small and cheap even when the user cranks the count up. */
export const MAX_CONTEXT_CHARS = 8000;

export const defaultAIAssistantConfig = (): AIAssistantConfig => ({
  enabled: false,
  baseUrl: "",
  apiKey: "",
  model: "",
  prompt: "",
  contextScope: "self",
  contextCount: DEFAULT_CONTEXT_COUNT,
});

export const loadAIAssistantConfig = (): AIAssistantConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAIAssistantConfig();
    return { ...defaultAIAssistantConfig(), ...(JSON.parse(raw) as Partial<AIAssistantConfig>) };
  } catch {
    return defaultAIAssistantConfig();
  }
};

export const saveAIAssistantConfig = (config: AIAssistantConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

/** Ready to run: the prompt falls back to a default, so it is not required here. */
export const isAIAssistantReady = (config: AIAssistantConfig): boolean =>
  config.enabled && Boolean(config.baseUrl.trim()) && Boolean(config.apiKey.trim()) && Boolean(config.model.trim());

export const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, "");

export const clampContextCount = (count: number): number =>
  Number.isFinite(count) ? Math.min(Math.max(Math.floor(count), 1), MAX_CONTEXT_COUNT) : DEFAULT_CONTEXT_COUNT;

/**
 * Reference notes first (newest first, trimmed to the budget), then the new card.
 * The scaffold is intentionally minimal; the user's prompt owns the analysis style.
 */
export const buildUserMessage = (content: string, context: string[]): string => {
  const items: string[] = [];
  let size = 0;
  for (const item of context.map((entry) => entry.trim()).filter(Boolean)) {
    if (size + item.length > MAX_CONTEXT_CHARS) break;
    size += item.length;
    items.push(item);
  }
  if (items.length === 0) return content;
  const contextBlock = items.map((item) => `- ${item}`).join("\n");
  return `以下是我最近的记录，仅供你参考背景（不用逐条分析）：\n${contextBlock}\n\n下面这张才是请你分析的新卡片：\n${content}`;
};

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export const requestAnalysis = async (config: AIAssistantConfig, content: string, context: string[]): Promise<string> => {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.model.trim(),
      messages: [
        { role: "system", content: config.prompt },
        { role: "user", content: buildUserMessage(content, context) },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI returned an empty response");
  return text;
};
