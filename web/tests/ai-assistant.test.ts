import { beforeEach, describe, expect, it } from "vitest";
import {
  buildUserMessage,
  clampContextCount,
  defaultAIAssistantConfig,
  isAIAssistantReady,
  loadAIAssistantConfig,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_COUNT,
  normalizeBaseUrl,
  saveAIAssistantConfig,
} from "@/lib/ai-assistant";

describe("ai-assistant config storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing is stored", () => {
    expect(loadAIAssistantConfig()).toEqual(defaultAIAssistantConfig());
  });

  it("round-trips saved config and fills new fields with defaults", () => {
    saveAIAssistantConfig({ ...defaultAIAssistantConfig(), enabled: true, model: "deepseek-chat" });
    expect(loadAIAssistantConfig()).toMatchObject({ enabled: true, model: "deepseek-chat", contextScope: "self" });
  });

  it("falls back to defaults on corrupted JSON", () => {
    localStorage.setItem("memos.ai-assistant-config", "{oops");
    expect(loadAIAssistantConfig()).toEqual(defaultAIAssistantConfig());
  });
});

describe("isAIAssistantReady", () => {
  it("requires the switch plus endpoint, key and model", () => {
    const base = { ...defaultAIAssistantConfig(), baseUrl: "https://api.deepseek.com", apiKey: "sk-x", model: "deepseek-chat" };
    expect(isAIAssistantReady(base)).toBe(false); // 未开启
    expect(isAIAssistantReady({ ...base, enabled: true })).toBe(true);
    expect(isAIAssistantReady({ ...base, enabled: true, apiKey: "  " })).toBe(false);
    expect(isAIAssistantReady({ ...base, enabled: true, model: "" })).toBe(false);
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
    expect(message).toContain("- 旧卡片二");
    expect(message.indexOf("旧卡片一")).toBeLessThan(message.indexOf("新卡片"));
  });

  it("skips blank entries and respects the character budget", () => {
    expect(buildUserMessage("新卡片", ["  ", "有效"])).not.toContain("-   ");
    const huge = "x".repeat(MAX_CONTEXT_CHARS);
    const message = buildUserMessage("新卡片", [huge, "放不下的第二张"]);
    expect(message).toContain("x".repeat(100));
    expect(message).not.toContain("放不下的第二张");
  });
});
