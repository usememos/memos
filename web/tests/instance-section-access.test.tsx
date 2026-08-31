import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstanceSection from "@/components/Settings/InstanceSection";
import { InstanceAccessMode } from "@/types/proto/api/v1/instance_service_pb";

const instance = vi.hoisted(() => ({
  accessSetting: { accessMode: 1 },
  generalSetting: {
    additionalScript: "",
    additionalStyle: "",
    customProfile: undefined,
    disallowChangeNickname: false,
    disallowChangeUsername: false,
    disallowPasswordAuth: false,
    disallowUserRegistration: false,
    weekStartDayOffset: 0,
  },
  profile: { demo: false },
  fetchSetting: vi.fn(),
  updateSetting: vi.fn(),
}));
const listIdentityProviders = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => instance,
}));

vi.mock("@/connect", () => ({
  identityProviderServiceClient: {
    listIdentityProviders,
  },
}));

vi.mock("@/components/UpdateCustomizedProfileDialog", () => ({ default: () => null }));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<InstanceSection> access setting", () => {
  beforeEach(() => {
    instance.accessSetting.accessMode = InstanceAccessMode.PRIVATE;
    listIdentityProviders.mockResolvedValue({ identityProviders: [] });
    instance.fetchSetting.mockReset().mockResolvedValue(undefined);
    instance.updateSetting.mockReset().mockResolvedValue(undefined);
  });

  it("saves public access through the dedicated ACCESS setting", async () => {
    render(<InstanceSection />);

    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(instance.updateSetting).toHaveBeenCalledTimes(1));
    const setting = instance.updateSetting.mock.calls[0][0];
    expect(setting.name).toBe("instance/settings/ACCESS");
    expect(setting.value.case).toBe("accessSetting");
    expect(setting.value.value.accessMode).toBe(InstanceAccessMode.PUBLIC);
    expect(instance.fetchSetting).not.toHaveBeenCalled();
  });
});
