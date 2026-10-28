import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstanceSection from "@/components/Settings/InstanceSection";
import { type ConfigurationStatus, ConfigurationStatusSchema, InstanceAccessMode } from "@/types/proto/api/instance_service_pb";

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
const configuration = vi.hoisted(() => ({ status: undefined as ConfigurationStatus | undefined }));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => instance,
}));

vi.mock("@/connect", () => ({
  identityProviderServiceClient: {
    listIdentityProviders,
  },
}));

vi.mock("@/hooks/useConfigurationQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useConfigurationQueries")>();
  return {
    ...actual,
    useConfigurationStatus: () => configuration.status,
    useManagedResource: (name: string) => actual.findManagedResource(configuration.status, name),
  };
});

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
    configuration.status = undefined;
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

  it("orders general settings before access policies and custom code", () => {
    render(<InstanceSection />);

    const groupHeadings = screen.getAllByRole("heading", { level: 4 });
    expect(groupHeadings.map((heading) => heading.textContent)).toEqual([
      "common.basic",
      "setting.instance.access-title",
      "setting.system.custom-code-title",
    ]);

    const weekStartDay = screen.getByText("setting.instance.week-start-day");
    const accessHeading = screen.getByRole("heading", { level: 4, name: "setting.instance.access-title" });
    expect(weekStartDay.compareDocumentPosition(accessHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("locks fields configuration manages and leaves released ones editable", () => {
    configuration.status = create(ConfigurationStatusSchema, {
      serial: 1n,
      managedResources: [
        {
          resource: "instance/settings/GENERAL",
          source: "instance.json",
          managedFields: ["*"],
          ignoredFields: ["generalSetting.additionalStyle"],
        },
      ],
    });
    render(<InstanceSection />);

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).not.toHaveAttribute("aria-disabled");
    // Base UI switches are spans that report being disabled through ARIA.
    expect(switches[1]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "common.edit" })).toBeDisabled();
    expect(screen.getByPlaceholderText("setting.system.additional-style-placeholder")).not.toBeDisabled();
    expect(screen.getByPlaceholderText("setting.system.additional-script-placeholder")).toBeDisabled();
    // Basic, access, and custom code each have a managed field, so each names the file.
    expect(screen.getAllByText("instance.json")).toHaveLength(3);
  });
});
