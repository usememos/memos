/**
 * AI 卡片助手：保存新卡片后，把内容发给你自己的 AI（OpenAI 兼容接口）分析，
 * 结果以评论形式追加到卡片上。
 *
 * v2 支持多助手：默认助手兜底，其余助手按标签路由（如「读书」标签 → 读书笔记助手）。
 * 配置存在浏览器 localStorage（个人实例场景），不上传服务器，每个浏览器各自配置。
 */

export type AIContextScope = "self" | "recent" | "tag";

export interface AIAssistantProfile {
  id: string;
  /** 助手名称，也是 AI 评论的署名；留空显示默认名。 */
  name: string;
  /** 匹配标签（不带 #）。空字符串 = 默认助手，任何未命中的卡片都归它。 */
  matchTag: string;
  /** 分析提示词；留空回落到当前语言的默认提示词。 */
  prompt: string;
  contextScope: AIContextScope;
  contextCount: number;
  enabled: boolean;
}

export interface AIAssistantConfig {
  /** 总开关。 */
  enabled: boolean;
  /** OpenAI-compatible base URL, e.g. https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 有且仅有一个 matchTag 为 "" 的默认助手。 */
  assistants: AIAssistantProfile[];
}

const STORAGE_KEY = "memos.ai-assistant-config";
export const DEFAULT_ASSISTANT_ID = "default";
export const DEFAULT_CONTEXT_COUNT = 10;
export const MAX_CONTEXT_COUNT = 50;
/** Keeps the request small and cheap even when the user cranks the count up. */
export const MAX_CONTEXT_CHARS = 8000;

export const newAssistantProfile = (partial?: Partial<AIAssistantProfile>): AIAssistantProfile => ({
  id: `asst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  matchTag: "",
  prompt: "",
  contextScope: "self",
  contextCount: DEFAULT_CONTEXT_COUNT,
  enabled: true,
  ...partial,
});

export const defaultAIAssistantConfig = (): AIAssistantConfig => ({
  enabled: false,
  baseUrl: "",
  apiKey: "",
  model: "",
  assistants: [newAssistantProfile({ id: DEFAULT_ASSISTANT_ID, matchTag: "" })],
});

/** v1 配置（单个 prompt/scope 挂在顶层）迁移为 v2 的默认助手。 */
const migrateConfig = (parsed: Record<string, unknown>): AIAssistantConfig => {
  const base = defaultAIAssistantConfig();
  if (Array.isArray(parsed.assistants)) {
    const assistants = (parsed.assistants as Partial<AIAssistantProfile>[]).map((a) => newAssistantProfile(a));
    if (!assistants.some((a) => a.id === DEFAULT_ASSISTANT_ID)) assistants.unshift(newAssistantProfile({ id: DEFAULT_ASSISTANT_ID }));
    return { ...base, ...parsed, assistants } as AIAssistantConfig;
  }
  const legacyScope = parsed.contextScope;
  return {
    ...base,
    enabled: Boolean(parsed.enabled),
    baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    model: typeof parsed.model === "string" ? parsed.model : "",
    assistants: [
      newAssistantProfile({
        id: DEFAULT_ASSISTANT_ID,
        matchTag: "",
        prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
        contextScope: legacyScope === "recent" || legacyScope === "tag" ? legacyScope : "self",
        contextCount: typeof parsed.contextCount === "number" ? parsed.contextCount : DEFAULT_CONTEXT_COUNT,
      }),
    ],
  };
};

export const loadAIAssistantConfig = (): AIAssistantConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAIAssistantConfig();
    return migrateConfig(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return defaultAIAssistantConfig();
  }
};

export const saveAIAssistantConfig = (config: AIAssistantConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

/** Ready to run: 总开关 + 接口三要素 + 至少一个启用的助手。提示词可回落到默认值，不参与判断。 */
export const isAIAssistantReady = (config: AIAssistantConfig): boolean =>
  config.enabled &&
  Boolean(config.baseUrl.trim()) &&
  Boolean(config.apiKey.trim()) &&
  Boolean(config.model.trim()) &&
  config.assistants.some((a) => a.enabled);

/** 标签助手优先，未命中回落到默认助手（id 固定为 DEFAULT_ASSISTANT_ID）；两者都被关闭则不分析。 */
export const pickAssistant = (config: AIAssistantConfig, tags: string[]): AIAssistantProfile | undefined => {
  if (!isAIAssistantReady(config)) return undefined;
  const enabled = config.assistants.filter((a) => a.enabled);
  return enabled.find((a) => a.matchTag && tags.includes(a.matchTag)) ?? enabled.find((a) => a.id === DEFAULT_ASSISTANT_ID);
};

export const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, "");

export const clampContextCount = (count: number): number =>
  Number.isFinite(count) ? Math.min(Math.max(Math.floor(count), 1), MAX_CONTEXT_COUNT) : DEFAULT_CONTEXT_COUNT;

/**
 * Reference notes first (newest first, trimmed to the budget), then the new card.
 * The scaffold is intentionally minimal; the assistant's prompt owns the analysis style.
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

/**
 * AI 评论的署名约定：正文开头带一段 HTML 注释标记（markdown 渲染时不可见），
 * 前端评论区检测到它就显示助手身份而非用户头像昵称。API/导出里能看到这段标记，属正常。
 */
const AI_COMMENT_MARKER_RE = /^<!--\s*ai-assistant:([\s\S]*?)\s*-->\s*/;

export const buildAICommentContent = (assistantName: string, analysis: string): string =>
  `<!-- ai-assistant:${assistantName.replace(/--+/g, "—").replace(/[<>]/g, "")} -->\n${analysis}`;

export const parseAIComment = (content: string | undefined): { assistantName: string; body: string } | null => {
  if (!content) return null;
  const match = content.match(AI_COMMENT_MARKER_RE);
  if (!match) return null;
  return { assistantName: match[1], body: content.slice(match[0].length) };
};

/** 渲染评论正文前剥掉署名标记；普通卡片内容原样返回。 */
export const stripAICommentMarker = (content: string | undefined): string => parseAIComment(content)?.body ?? content ?? "";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface AIProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const requestAnalysis = async (provider: AIProviderConfig, prompt: string, content: string, context: string[]): Promise<string> => {
  const response = await fetch(`${normalizeBaseUrl(provider.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: provider.model.trim(),
      messages: [
        { role: "system", content: prompt },
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
