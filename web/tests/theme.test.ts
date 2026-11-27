import { beforeEach, describe, expect, it } from "vitest";
import { loadTheme } from "@/utils/theme";

describe("theme-color meta tags update", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fafafa" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f0f0f" />
    `;
    localStorage.clear();
  });

  it("updates meta tags to specific theme color when a non-system theme is loaded", () => {
    loadTheme("default-dark");

    const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
    const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');

    expect(lightMeta?.content).toBe("#0f0f0f");
    expect(darkMeta?.content).toBe("#0f0f0f");
  });

  it("restores adaptive meta tags when system theme is loaded", () => {
    loadTheme("paper");
    loadTheme("system");

    const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
    const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');

    expect(lightMeta?.content).toBe("#fafafa");
    expect(darkMeta?.content).toBe("#0f0f0f");
  });
});
