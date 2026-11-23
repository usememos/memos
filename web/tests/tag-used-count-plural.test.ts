import i18next from "i18next";
import { describe, expect, it } from "vitest";
import english from "../src/locales/en.json";

interface Messages {
  setting?: { tags?: Record<string, unknown> };
}

const locales = import.meta.glob<{ default: Messages }>("../src/locales/*.json", { eager: true });

describe("tag used-count plural forms", () => {
  it("uses the singular for one memo in English", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: "en", resources: { en: { translation: english } } });

    expect(i18n.t("setting.tags.used-count", { count: 1 })).toBe("1 memo");
    expect(i18n.t("setting.tags.used-count", { count: 2 })).toBe("2 memos");
  });

  for (const [path, module] of Object.entries(locales)) {
    const locale = path.replace(/^.*\/(.+)\.json$/, "$1");

    it(`defines every plural category of ${locale}`, () => {
      const tags = module.default.setting?.tags ?? {};
      // A missing category falls back to English, so each one the language uses must be present.
      for (const category of new Intl.PluralRules(locale).resolvedOptions().pluralCategories) {
        expect(tags[`used-count_${category}`], `${locale} used-count_${category}`).toEqual(expect.any(String));
      }
    });
  }
});
