import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { getLocaleDirection, loadLocale, subscribeToLocaleDirection } from "@/utils/i18n";

const originalLanguage = i18n.language;
const originalLangAttribute = document.documentElement.getAttribute("lang");
const originalDirAttribute = document.documentElement.getAttribute("dir");

const restoreAttribute = (name: "lang" | "dir", value: string | null) => {
  if (value === null) {
    document.documentElement.removeAttribute(name);
  } else {
    document.documentElement.setAttribute(name, value);
  }
};

describe("document locale direction", () => {
  afterEach(async () => {
    localStorage.clear();
    restoreAttribute("lang", originalLangAttribute);
    restoreAttribute("dir", originalDirAttribute);
    await i18n.changeLanguage(originalLanguage);
  });

  it.each([
    ["ar", "rtl"],
    ["fa", "rtl"],
    ["he", "rtl"],
    ["en", "ltr"],
  ] as const)("sets %s as a %s document", (locale, direction) => {
    loadLocale(locale);

    expect(document.documentElement).toHaveAttribute("lang", locale);
    expect(document.documentElement).toHaveAttribute("dir", direction);
  });

  it("notifies direction consumers before translations finish loading", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLocaleDirection(listener);

    loadLocale("ar");

    expect(getLocaleDirection()).toBe("rtl");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
