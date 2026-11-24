import i18next from "i18next";
import { describe, expect, it } from "vitest";
import english from "../src/locales/en.json";

interface Messages {
  setting?: { "memo-export"?: Record<string, unknown> };
}

const locales = import.meta.glob<{ default: Messages }>("../src/locales/*.json", { eager: true });
const keys = ["import-confirm", "policy-question"];

describe("memo import count plural forms", () => {
  it("uses the singular for one memo in English", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: "en", resources: { en: { translation: english } } });

    expect(i18n.t("setting.memo-export.import-confirm", { count: 1 })).toBe("Import 1 memo");
    expect(i18n.t("setting.memo-export.import-confirm", { count: 2 })).toBe("Import 2 memos");
    expect(i18n.t("setting.memo-export.policy-question", { count: 1 })).toBe(
      "1 of these memos already exists in your account. What should happen to it?",
    );
    expect(i18n.t("setting.memo-export.policy-question", { count: 3 })).toBe(
      "3 of these memos already exist in your account. What should happen to them?",
    );
  });

  for (const [path, module] of Object.entries(locales)) {
    const locale = path.replace(/^.*\/(.+)\.json$/, "$1");

    it(`defines every plural category of ${locale}`, () => {
      const messages = module.default.setting?.["memo-export"] ?? {};
      // A missing category falls back to English, so each one the language uses must be present.
      for (const category of new Intl.PluralRules(locale).resolvedOptions().pluralCategories) {
        for (const key of keys) {
          expect(messages[`${key}_${category}`], `${locale} ${key}_${category}`).toEqual(expect.any(String));
        }
      }
    });
  }
});
