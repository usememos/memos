import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserLocale } from "@/hooks/useUserLocale";
import i18n from "@/i18n";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userGeneralSetting: { locale: "ar" } }),
}));

const originalLanguage = i18n.language;
const originalLangAttribute = document.documentElement.getAttribute("lang");
const originalDirAttribute = document.documentElement.getAttribute("dir");

describe("useUserLocale", () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("memos-locale", "en");
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    localStorage.clear();
    if (originalLangAttribute === null) document.documentElement.removeAttribute("lang");
    else document.documentElement.lang = originalLangAttribute;
    if (originalDirAttribute === null) document.documentElement.removeAttribute("dir");
    else document.documentElement.dir = originalDirAttribute;
    await i18n.changeLanguage(originalLanguage);
  });

  it("keeps the user setting direction while its translations load", async () => {
    const { result } = renderHook(() => useUserLocale());

    await waitFor(() => expect(result.current).toBe("rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
