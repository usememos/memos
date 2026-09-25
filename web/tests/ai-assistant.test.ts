import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAICommentContent,
  buildUserMessage,
  clampContextCount,
  defaultAIAssistantConfig,
  isAIAssistantReady,
  loadAIAssistantConfig,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_COUNT,
  newAssistantProfile,
  normalizeBaseUrl,
  parseAIComment,
  pickAssistant,
  saveAIAssistantConfig,
  stripAICommentMarker,
} from "@/lib/ai-assistant";

const readyConfig = () => {
  const config = defaultAIAssistantConfig();
  config.enabled = true;
  config.baseUrl = "https://api.deepseek.com";
  config.apiKey = "sk-x";
  config.model = "deepseek-chat";
  return config;
};

describe("ai-assistant config storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing is stored", () => {
    expect(loadAIAssistantConfig()).toEqual(defaultAIAssistantConfig());
  });

  it("round-trips saved v2 config", () => {
    const config = readyConfig();
    config.assistants.push(newAssistantProfile({ name: "读书笔记助手", matchTag: "读书", prompt: "书评风格" }));
    saveAIAssistantConfig(config);
    expect(loadAIAssistantConfig()).toMatchObject({ enabled: true, model: "deepseek-chat" });
    expect(loadAIAssistantConfig().assistants).toHaveLength(2);
  });

  it("migrates v1 single-prompt config into the default assistant", () => {
    localStorage.setItem(
      "memos.ai-assistant-config",
      JSON.stringify({
        enabled: true,
        baseUrl: "https://a.com",
        apiKey: "k",
        model: "m",
        prompt: "旧提示词",
        contextScope: "recent",
        contextCount: 5,
      }),
    );
    const config = loadAIAssistantConfig();
    expect(config.assistants).toHaveLength(1);
    expect(config.assistants[0]).toMatchObject({ matchTag: "", prompt: "旧提示词", contextScope: "recent", contextCount: 5 });
  });

  it("falls back to defaults on corrupted JSON", () => {
    localStorage.setItem("memos.ai-assistant-config", "{oops");
    expect(loadAIAssistantConfig()).toEqual(defaultAIAssistantConfig());
  });
});

describe("pickAssistant 路由", () => {
  it("按标签命中专属助手，未命中回落默认助手", () => {
    const config = readyConfig();
    config.assistants.push(newAssistantProfile({ id: "reading", name: "读书笔记助手", matchTag: "读书" }));
    expect(pickAssistant(config, ["读书"])?.id).toBe("reading");
    expect(pickAssistant(config, ["随笔"])?.id).toBe("default");
    expect(pickAssistant(config, [])?.id).toBe("default");
  });

  it("总开关关闭或助手被停用时不分析", () => {
    const config = readyConfig();
    expect(pickAssistant({ ...config, enabled: false }, ["读书"])).toBeUndefined();
    config.assistants[0].enabled = false; // 默认助手被关
    expect(pickAssistant(config, ["没有匹配"])).toBeUndefined();
  });

  it("命中的标签助手被停用时回落到默认助手", () => {
    const config = readyConfig();
    config.assistants.push(newAssistantProfile({ id: "reading", matchTag: "读书", enabled: false }));
    expect(pickAssistant(config, ["读书"])?.id).toBe("default");
  });
});

describe("AI 评论署名标记", () => {
  it("build 和 parse 往返一致", () => {
    const content = buildAICommentContent("读书笔记助手", "这是分析内容。\n第二行。");
    expect(parseAIComment(content)).toEqual({ assistantName: "读书笔记助手", body: "这是分析内容。\n第二行。" });
  });

  it("普通内容解析为空，strip 原样返回", () => {
    expect(parseAIComment("普通人写的评论")).toBeNull();
    expect(stripAICommentMarker("普通人写的评论")).toBe("普通人写的评论");
  });

  it("助手名里的连字符会被消毒，不会撑破注释", () => {
    const content = buildAICommentContent("小--助<手>", "分析");
    const parsed = parseAIComment(content);
    expect(parsed?.assistantName).toBe("小—助手");
    expect(parsed?.body).toBe("分析");
  });
});

describe("isAIAssistantReady", () => {
  it("要求总开关、接口三要素和至少一个启用的助手", () => {
    const base = readyConfig();
    expect(isAIAssistantReady(base)).toBe(true);
    expect(isAIAssistantReady({ ...base, enabled: false })).toBe(false);
    expect(isAIAssistantReady({ ...base, apiKey: "  " })).toBe(false);
    const noAssistant = { ...base, assistants: base.assistants.map((a) => ({ ...a, enabled: false })) };
    expect(isAIAssistantReady(noAssistant)).toBe(false);
  });
});

describe("normalizeBaseUrl / clampContextCount", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl(" https://api.deepseek.com/v1/ ")).toBe("https://api.deepseek.com/v1");
  });

  it("clamps the reference count into [1, MAX]", () => {
    expect(clampContextCount(0)).toBe(1);
    expect(clampContextCount(999)).toBe(MAX_CONTEXT_COUNT);
    expect(clampContextCount(Number.NaN)).toBe(10);
  });
});

describe("buildUserMessage", () => {
  it("returns the bare card when there is no context", () => {
    expect(buildUserMessage("新卡片", [])).toBe("新卡片");
  });

  it("puts reference notes before the new card", () => {
    const message = buildUserMessage("新卡片", ["旧卡片一", "旧卡片二"]);
    expect(message).toContain("- 旧卡片一");
    expect(message.indexOf("旧卡片一")).toBeLessThan(message.indexOf("新卡片"));
  });

  it("skips blank entries and respects the character budget", () => {
    expect(buildUserMessage("新卡片", ["  ", "有效"])).not.toContain("-   ");
    const huge = "x".repeat(MAX_CONTEXT_CHARS);
    expect(buildUserMessage("新卡片", [huge, "放不下的第二张"])).not.toContain("放不下的第二张");
  });
});
