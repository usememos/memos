import { describe, expect, it } from "vitest";
import { locales } from "@/i18n";
import enTranslation from "@/locales/en.json";
import heTranslation from "@/locales/he.json";
import { getLocaleSearchLabels, localeMatchesSearch, normalizeLocaleSearchText } from "@/utils/i18n";

const flattenTranslationKeys = (value: unknown, prefix = ""): string[] => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => flattenTranslationKeys(child, prefix ? `${prefix}.${key}` : key));
  }

  return [prefix];
};

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

  it("includes Hebrew in the supported locale list", () => {
    expect(locales).toContain("he");
    expect(localeMatchesSearch("he", "hebrew", "en")).toBe(true);
  });

  it("keeps Hebrew keys within the current English catalog", () => {
    expect(flattenTranslationKeys(enTranslation).sort()).toEqual(expect.arrayContaining(flattenTranslationKeys(heTranslation).sort()));
    expect(heTranslation.setting).toHaveProperty("ai");
    expect(heTranslation.setting).toHaveProperty("notification");
    expect(heTranslation.auth).not.toHaveProperty("host-tip");
  });

  it("uses future-oriented wording for expiring Hebrew links and tokens", () => {
    expect(heTranslation.memo.share["expires-on"]).toBe("יפוג תוקף בתאריך {{date}}");
    expect(heTranslation.setting["access-token"].expires).toBe("יפוג תוקף");
    expect(heTranslation.setting["access-token"]["guideline-expiration"]).toContain("שתוקפם יפוג");
  });
});
