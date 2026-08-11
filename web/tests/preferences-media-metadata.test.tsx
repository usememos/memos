import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetchSettings: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { name: "users/alice" },
    userGeneralSetting: {
      locale: "en",
      memoVisibility: "PRIVATE",
      theme: "system",
      saveMediaMetadata: false,
    },
    refetchSettings: mocks.refetchSettings,
  }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useUpdateUserGeneralSetting: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  loadLocale: vi.fn(),
  useTranslate: () => (key: string) => key,
}));

vi.mock("@/utils/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/theme")>()),
  loadTheme: vi.fn(),
}));

import PreferencesSection from "@/components/Settings/PreferencesSection";

describe("PreferencesSection media metadata setting", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
  });

  it("updates the account setting with the save_media_metadata field mask", () => {
    render(<PreferencesSection />);

    fireEvent.click(screen.getByRole("switch", { name: "setting.preference.save-media-metadata" }));

    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate.mock.calls[0][0]).toEqual({
      generalSetting: { saveMediaMetadata: true },
      updateMask: ["save_media_metadata"],
    });
  });
});
