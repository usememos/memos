import { fireEvent, render, screen } from "@testing-library/react";
import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstanceSection from "@/components/Settings/InstanceSection";
import {
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_Key,
} from "@/types/proto/api/v1/instance_service_pb";
import { buildInstanceSettingName } from "@/components/Settings/useInstanceSettingUpdater";

const generalSetting = vi.hoisted(() => ({} as InstanceSetting_GeneralSetting));
const instanceProfile = vi.hoisted(() => ({ demo: false }));
const saveInstanceSetting = vi.hoisted(() => vi.fn());
const listIdentityProviders = vi.hoisted(() => vi.fn());

vi.mock("@/connect", () => ({
  identityProviderServiceClient: {
    listIdentityProviders,
  },
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ generalSetting, profile: instanceProfile }),
}));

vi.mock("@/hooks/useDialog", () => ({
  default: () => ({ isOpen: false, open: vi.fn(), setOpen: vi.fn() }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

vi.mock("@/components/UpdateCustomizedProfileDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/Settings/useInstanceSettingUpdater", () => ({
  default: () => saveInstanceSetting,
  buildInstanceSettingName: (key: unknown) => `instance/settings/${String(key)}`,
}));

describe("InstanceSection public-access switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listIdentityProviders.mockResolvedValue({ identityProviders: [] });
    instanceProfile.demo = false;
    Object.assign(generalSetting, create(InstanceSetting_GeneralSettingSchema, {}));
  });

  it("saves the explicit policy through the shared instance-setting updater", () => {
    saveInstanceSetting.mockResolvedValue(true);
    render(<InstanceSection />);

    expect(screen.getByText("setting.instance.allow-public-access")).toBeInTheDocument();
    expect(screen.getByText("setting.instance.allow-public-access-description")).toBeInTheDocument();

    // Save starts disabled; nothing changed yet.
    const save = screen.getByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();

    const switches = screen.getAllByRole("switch");
    const publicAccessSwitch = switches[0];
    expect(publicAccessSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(publicAccessSwitch);

    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(saveInstanceSetting).toHaveBeenCalledTimes(1);
    const options = saveInstanceSetting.mock.calls[0][0];
    expect(options.key).toBe(InstanceSetting_Key.GENERAL);
    expect(options.setting.name).toBe(buildInstanceSettingName(InstanceSetting_Key.GENERAL));
    expect(options.setting.value.value.allowPublicAccess).toBe(true);
  });

  it("starts checked when public access is already enabled", () => {
    Object.assign(generalSetting, create(InstanceSetting_GeneralSettingSchema, { allowPublicAccess: true }));
    render(<InstanceSection />);

    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true");
  });

  it("is disabled in demo mode", () => {
    instanceProfile.demo = true;
    render(<InstanceSection />);

    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-disabled", "true");
  });
});
