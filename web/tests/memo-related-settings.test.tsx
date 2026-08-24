import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import {
  type InstanceSetting,
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";

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

describe("<MemoRelatedSettings> content length limit", () => {
  beforeEach(() => {
    mocks.instance.memoRelatedSetting = create(InstanceSetting_MemoRelatedSettingSchema, {
      contentLengthLimit: 32_768,
      enableDoubleClickEdit: false,
      reactions: ["thumbs-up"],
    });
    mocks.instance.updateSetting.mockReset().mockResolvedValue(undefined);
    mocks.instance.fetchSetting.mockReset().mockResolvedValue(undefined);
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it.each([8_192, 16_384])("saves a valid %i-byte limit in the memo-related setting", async (contentLengthLimit) => {
    render(<MemoRelatedSettings />);

    const input = screen.getByRole("spinbutton", { name: "setting.memo.content-length-limit" });
    expect(input).toHaveAttribute("min", "8192");
    expect(input).toHaveAttribute("max", "2147483647");
    expect(input).toHaveAttribute("step", "1");
    expect(screen.getByText("setting.memo.content-length-limit-minimum")).toBeVisible();

    fireEvent.change(input, { target: { value: String(contentLengthLimit) } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.instance.updateSetting).toHaveBeenCalledTimes(1));
    const setting = mocks.instance.updateSetting.mock.calls[0][0] as InstanceSetting;
    expect(setting.name).toBe("instance/settings/MEMO_RELATED");
    expect(setting.value.case).toBe("memoRelatedSetting");
    if (setting.value.case !== "memoRelatedSetting") {
      throw new Error("Expected memo-related setting payload");
    }
    expect(setting.value.value.contentLengthLimit).toBe(contentLengthLimit);
    expect(setting.value.value.reactions).toEqual(["thumbs-up"]);
    expect(mocks.instance.fetchSetting).toHaveBeenCalledWith(InstanceSetting_Key.MEMO_RELATED);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty value", ""],
    ["a value below the minimum", "8191"],
    ["a fractional value", "8192.5"],
    ["a value above int32", "2147483648"],
  ])("blocks %s before calling the update API", (_scenario, value) => {
    render(<MemoRelatedSettings />);

    const input = screen.getByRole("spinbutton", { name: "setting.memo.content-length-limit" });
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(mocks.instance.updateSetting).not.toHaveBeenCalled();
    expect(mocks.instance.fetchSetting).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("setting.memo.content-length-limit-error");
  });
});
