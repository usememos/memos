import { describe, expect, it } from "vitest";

interface LocaleMessages {
  common?: Record<string, unknown>;
  setting?: Record<string, Record<string, unknown>>;
}

const localeModules = import.meta.glob<{ default: LocaleMessages }>("../src/locales/*.json", { eager: true });

describe("memo view locale resources", () => {
  for (const [path, module] of Object.entries(localeModules)) {
    it(`uses only the memo view resource keys in ${path}`, () => {
      const messages = module.default;

      expect(messages.common?.views).toEqual(expect.any(String));
      expect(messages.setting?.["memo-view"]?.["delete-confirm"]).toEqual(expect.any(String));
      expect(messages.setting?.["memo-view"]?.["delete-success"]).toEqual(expect.any(String));

      expect(messages.common?.["shortcut-filter"]).toBeUndefined();
      expect(messages.common?.shortcuts).toBeUndefined();
      expect(messages.setting?.shortcut).toBeUndefined();
    });
  }
});
