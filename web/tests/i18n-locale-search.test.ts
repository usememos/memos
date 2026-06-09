import { describe, expect, it } from "vitest";
import { getLocaleSearchLabels, localeMatchesSearch, normalizeLocaleSearchText } from "@/utils/i18n";

describe("locale search helpers", () => {
  it("normalizes case and diacritics for locale search", () => {
    expect(normalizeLocaleSearchText("Português")).toBe("portugues");
  });

  it("includes locale code, native name, and English name", () => {
    const labels = getLocaleSearchLabels("ja", "en");

    expect(labels).toContain("ja");
    expect(labels).toContain("日本語");
    expect(labels).toContain("Japanese");
  });

  it("matches by code, native display name, English display name, and accent-free text", () => {
    expect(localeMatchesSearch("pt-PT", "pt", "en")).toBe(true);
    expect(localeMatchesSearch("ja", "日本", "en")).toBe(true);
    expect(localeMatchesSearch("de", "german", "en")).toBe(true);
    expect(localeMatchesSearch("pt-PT", "portugues", "en")).toBe(true);
    expect(localeMatchesSearch("ja", "romanian", "en")).toBe(false);
  });
});
