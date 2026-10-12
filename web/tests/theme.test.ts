import { beforeEach, describe, expect, it } from "vitest";
import { loadTheme } from "@/utils/theme";

describe("theme-color meta tags update", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf9f5" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1d1f23" />
    `;
    localStorage.clear();
  });

  it("updates meta tags to specific theme color when a non-system theme is loaded", () => {
    loadTheme("default-dark");

    const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
    const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');

    expect(lightMeta?.content).toBe("#1d1f23");
    expect(darkMeta?.content).toBe("#1d1f23");
  });

  it("restores adaptive meta tags when system theme is loaded", () => {
    loadTheme("paper");
    loadTheme("system");

    const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
    const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');

    expect(lightMeta?.content).toBe("#faf9f5");
    expect(darkMeta?.content).toBe("#1d1f23");
  });
});
