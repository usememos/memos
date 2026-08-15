import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "@bufbuild/protobuf";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { InstanceProvider, useInstance } from "@/contexts/InstanceContext";
import {
  InstanceSetting_GeneralSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";

const updateInstanceSetting = vi.hoisted(() => vi.fn());

vi.mock("@/connect", () => ({
  instanceServiceClient: {
    updateInstanceSetting,
  },
}));

// A consumer that triggers updates and renders the effective profile flag,
// mirroring how routing code reads profile.allowPublicAccess.
const Probe = ({ allow }: { allow: boolean }) => {
  const { profile, updateSetting } = useInstance();
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <span data-testid="effective">{String(profile.allowPublicAccess)}</span>
      <button
        type="button"
        onClick={() => {
          updateSetting(
            create(InstanceSettingSchema, {
              name: "instance/settings/GENERAL",
              value: {
                case: "generalSetting",
                value: create(InstanceSetting_GeneralSettingSchema, { allowPublicAccess: allow }),
              },
            }),
          ).then(() => setSaved(true));
        }}
      >
        save
      </button>
      {saved && <span data-testid="saved" />}
    </div>
  );
};

describe("InstanceContext public-access profile sync", () => {
  it("flips profile.allowPublicAccess immediately after a GENERAL update", async () => {
    // The server echoes the saved setting back from UpdateInstanceSetting.
    updateInstanceSetting.mockImplementation((request: { setting: unknown }) => Promise.resolve(request.setting));

    render(<InstanceProvider>
      <Probe allow />
    </InstanceProvider>);
    expect(screen.getByTestId("effective")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("saved")).toBeInTheDocument());
    expect(screen.getByTestId("effective")).toHaveTextContent("true");
  });
});
