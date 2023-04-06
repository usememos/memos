import { convertLanguageCodeToLocale } from "@/utils/i18n";

describe("convertLanguageCodeToLocale", () => {
  it("test zh hant convert to zh-Hant", () => {
    expect(convertLanguageCodeToLocale("zh-TW")).toBe("hant");
    expect(convertLanguageCodeToLocale("zh-HK")).toBe("hant");
  });
  it("test zh  convert to zh", () => {
    expect(convertLanguageCodeToLocale("zh-CN")).toBe("zh");
  });
  it("test convert language from first work", () => {
    expect(convertLanguageCodeToLocale("en-US")).toBe("en");
  });
});
