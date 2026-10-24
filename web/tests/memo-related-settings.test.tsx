import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import { type InstanceSetting, InstanceSetting_Key, InstanceSetting_MemoRelatedSettingSchema } from "@/types/proto/api/instance_service_pb";

const mocks = vi.hoisted(() => ({
  instance: {
    memoRelatedSetting: {},
    updateSetting: vi.fn(),
    fetchSetting: vi.fn(),
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => mocks.instance,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("<MemoRelatedSettings>", () => {
  beforeEach(() => {
    mocks.instance.memoRelatedSetting = create(InstanceSetting_MemoRelatedSettingSchema, {
      reactions: ["thumbs-up"],
    });
    mocks.instance.updateSetting.mockReset().mockResolvedValue(undefined);
    mocks.instance.fetchSetting.mockReset().mockResolvedValue(undefined);
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it("saves only the reaction list", async () => {
    render(<MemoRelatedSettings />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("setting.memo.reaction-placeholder"), { target: { value: "heart" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.memo.add-reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mocks.instance.updateSetting).toHaveBeenCalledTimes(1));
    const setting = mocks.instance.updateSetting.mock.calls[0][0] as InstanceSetting;
    expect(setting.name).toBe("instance/settings/MEMO_RELATED");
    if (setting.value.case !== "memoRelatedSetting") throw new Error("Expected memo-related setting");
    expect(setting.value.value).toEqual(create(InstanceSetting_MemoRelatedSettingSchema, { reactions: ["thumbs-up", "heart"] }));
    expect(mocks.instance.fetchSetting).toHaveBeenCalledWith(InstanceSetting_Key.MEMO_RELATED);
  });
});
