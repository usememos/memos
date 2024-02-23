import { create } from "zustand";
import { combine } from "zustand/middleware";
import { workspaceSettingServiceClient } from "@/grpcweb";
import { WorkspaceSetting } from "@/types/proto/api/v2/workspace_setting_service";
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
    fetchWorkspaceSetting: async (key: WorkspaceSettingKey) => {
      const { setting } = await workspaceSettingServiceClient.getWorkspaceSetting({ name: `${WorkspaceSettingPrefix}${key}` });
      if (!setting) {
        throw new Error("Workspace setting not found");
      }
      set({ workspaceSettingByName: { ...get().workspaceSettingByName, [setting.name]: setting } });
    },
    getWorkspaceSettingByKey: (key: WorkspaceSettingKey): WorkspaceSetting => {
      return get().workspaceSettingByName[`${WorkspaceSettingPrefix}${key}`] || WorkspaceSetting.fromPartial({});
    },
  })),
);
