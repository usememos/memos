import { create } from "zustand";
import { combine } from "zustand/middleware";
import { workspaceSettingServiceClient } from "@/grpcweb";
import { WorkspaceSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { WorkspaceSettingPrefix } from "./resourceName";

interface State {
  workspaceSettingByName: Record<string, WorkspaceSetting>;
}

const getDefaultState = (): State => ({
  workspaceSettingByName: {},
});

export const useWorkspaceSettingStore = create(
  combine(getDefaultState(), (set, get) => ({
    getState: () => {
      return get();
    },
    fetchWorkspaceSetting: async (key: WorkspaceSettingKey) => {
      const setting = await workspaceSettingServiceClient.getWorkspaceSetting({ name: `${WorkspaceSettingPrefix}${key}` });
      set({ workspaceSettingByName: { ...get().workspaceSettingByName, [setting.name]: setting } });
    },
    getWorkspaceSettingByKey: (key: WorkspaceSettingKey): WorkspaceSetting => {
      return get().workspaceSettingByName[`${WorkspaceSettingPrefix}${key}`] || WorkspaceSetting.fromPartial({});
    },
    setWorkspaceSetting: async (setting: WorkspaceSetting) => {
      await workspaceSettingServiceClient.setWorkspaceSetting({ setting });
      set({ workspaceSettingByName: { ...get().workspaceSettingByName, [setting.name]: setting } });
    },
  })),
);
