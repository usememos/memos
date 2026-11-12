import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_PREFERENCES_KEY, updateDevicePreferences } from "@/hooks/useDevicePreferences";

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

describe("PreferencesSection", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    localStorage.clear();
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

  it("toggles device preferences in this browser without touching the account setting", () => {
    render(<PreferencesSection />);

    fireEvent.click(screen.getByRole("switch", { name: "memo.link-preview" }));
    fireEvent.click(screen.getByRole("switch", { name: "setting.preference.double-click-edit" }));

    expect(JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? "null")).toEqual({ linkPreview: false, doubleClickEdit: true });
    expect(mocks.mutate).not.toHaveBeenCalled();

    act(() => updateDevicePreferences({ linkPreview: true }));
    expect(screen.getByRole("switch", { name: "memo.link-preview" })).toBeChecked();
  });
});
