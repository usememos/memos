import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstanceProvider, useInstance } from "@/contexts/InstanceContext";
import { instanceKeys, useAccessSetting, useUpdateInstanceSetting } from "@/hooks/useInstanceQueries";
import {
  InstanceAccessMode,
  InstanceProfileSchema,
  InstanceSetting_AccessSettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";

const clients = vi.hoisted(() => ({
  batchGetInstanceSettings: vi.fn(),
  getInstanceProfile: vi.fn(),
  getInstanceSetting: vi.fn(),
  updateInstanceSetting: vi.fn(),
}));

vi.mock("@/connect", () => ({
  instanceServiceClient: clients,
}));

const buildAccessSetting = (accessMode: InstanceAccessMode) =>
  create(InstanceSettingSchema, {
    name: "instance/settings/ACCESS",
    value: {
      case: "accessSetting",
      value: create(InstanceSetting_AccessSettingSchema, { accessMode }),
    },
  });

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

const InstanceProbe = () => {
  const { accessSetting, initialize, profile, updateSetting } = useInstance();
  return (
    <div>
      <output data-testid="profile-access">{profile.accessMode}</output>
      <output data-testid="setting-access">{accessSetting.accessMode}</output>
      <button type="button" onClick={() => void initialize()}>
        Initialize
      </button>
      <button type="button" onClick={() => void updateSetting(buildAccessSetting(InstanceAccessMode.PUBLIC))}>
        Make public
      </button>
    </div>
  );
};

describe("instance ACCESS React Query integration", () => {
  beforeEach(() => {
    clients.batchGetInstanceSettings.mockReset().mockResolvedValue({ settings: [] });
    clients.getInstanceProfile.mockReset().mockResolvedValue(create(InstanceProfileSchema, { accessMode: InstanceAccessMode.PRIVATE }));
    clients.getInstanceSetting.mockReset().mockResolvedValue(buildAccessSetting(InstanceAccessMode.PRIVATE));
    clients.updateInstanceSetting.mockReset().mockResolvedValue(buildAccessSetting(InstanceAccessMode.PUBLIC));
  });

  it("updates the exact ACCESS cache from the mutation response without refetching", async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => ({
        access: useAccessSetting(),
        update: useUpdateInstanceSetting(),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.access.data?.accessMode).toBe(InstanceAccessMode.PRIVATE));

    await act(async () => {
      await result.current.update.mutateAsync(buildAccessSetting(InstanceAccessMode.PUBLIC));
    });

    await waitFor(() => expect(result.current.access.data?.accessMode).toBe(InstanceAccessMode.PUBLIC));
    expect(clients.getInstanceSetting).toHaveBeenCalledTimes(1);
    expect(clients.updateInstanceSetting).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(instanceKeys.setting(InstanceSetting_Key.ACCESS))).toEqual(
      buildAccessSetting(InstanceAccessMode.PUBLIC),
    );
  });

  it("keeps ACCESS out of context settings state and synchronizes the routing profile after update", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <InstanceProvider>
          <InstanceProbe />
        </InstanceProvider>
      </QueryClientProvider>,
    );

    // Until either request settles, both values remain UNSPECIFIED, which the
    // routing layer treats as private.
    expect(screen.getByTestId("profile-access")).toHaveTextContent(String(InstanceAccessMode.UNSPECIFIED));
    expect(screen.getByTestId("setting-access")).toHaveTextContent(String(InstanceAccessMode.UNSPECIFIED));

    fireEvent.click(screen.getByRole("button", { name: "Initialize" }));
    await waitFor(() => expect(screen.getByTestId("profile-access")).toHaveTextContent(String(InstanceAccessMode.PRIVATE)));
    await waitFor(() => expect(screen.getByTestId("setting-access")).toHaveTextContent(String(InstanceAccessMode.PRIVATE)));

    expect(clients.batchGetInstanceSettings).toHaveBeenCalledWith({
      names: ["instance/settings/GENERAL", "instance/settings/MEMO_RELATED"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Make public" }));
    await waitFor(() => expect(screen.getByTestId("profile-access")).toHaveTextContent(String(InstanceAccessMode.PUBLIC)));
    expect(screen.getByTestId("setting-access")).toHaveTextContent(String(InstanceAccessMode.PUBLIC));
    expect(clients.getInstanceSetting).toHaveBeenCalledTimes(1);
  });
});
