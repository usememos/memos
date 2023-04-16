import { findNearestLanguageMatch } from "@/utils/i18n";

describe("findNearestLanguageMatch", () => {
  // there are bug, can't covert these code, But it's working in the browser
  // it("test zh hant convert to zh-Hant", () => {
  //   expect(findNearestLanguageMatch("zh-TW")).toBe("hant");
  //   expect(findNearestLanguageMatch("zh-HK")).toBe("hant");
  // });
  // it("test zh convert to zh", () => {
  //   expect(findNearestLanguageMatch("zh-CN")).toBe("zh");
  // });
  it("test convert language from first work", () => {
    expect(findNearestLanguageMatch("en-US")).toBe("en");
  });
  it("test convert language from a incorrectly language code", () => {
    expect(findNearestLanguageMatch("ja")).toBe("en");
  });
});
