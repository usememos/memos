import { uniqBy } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { workspaceServiceClient } from "@/grpcweb";
import { WorkspaceProfile, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import {
  WorkspaceSetting_GeneralSetting,
  WorkspaceSetting_MemoRelatedSetting,
  WorkspaceSetting_AiSetting,
  WorkspaceSetting,
} from "@/types/proto/api/v1/workspace_service";
import { isValidateLocale } from "@/utils/i18n";
import { workspaceSettingNamePrefix } from "./common";

class LocalState {
  locale: string = "en";
  theme: string = "default";
  profile: WorkspaceProfile = WorkspaceProfile.fromPartial({});
  settings: WorkspaceSetting[] = [];

  get generalSetting() {
    return (
      this.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`)?.generalSetting ||
      WorkspaceSetting_GeneralSetting.fromPartial({})
    );
  }

  get memoRelatedSetting() {
    return (
      this.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.MEMO_RELATED}`)
        ?.memoRelatedSetting || WorkspaceSetting_MemoRelatedSetting.fromPartial({})
    );
  }

  get aiSetting() {
    return (
      this.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.AI}`)?.aiSetting ||
      WorkspaceSetting_AiSetting.fromPartial({
        enableAi: false,
        baseUrl: "",
        apiKey: "",
        model: "",
        timeoutSeconds: 10,
      })
    );
  }

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    const finalState = {
      ...this,
      ...partial,
    };
    if (!isValidateLocale(finalState.locale)) {
      finalState.locale = "en";
    }
    if (!["default", "default-dark", "paper", "whitewall"].includes(finalState.theme)) {
      finalState.theme = "default";
    }
    Object.assign(this, finalState);
  }
}

const workspaceStore = (() => {
  const state = new LocalState();

  const fetchWorkspaceSetting = async (settingKey: WorkspaceSetting_Key) => {
    const setting = await workspaceServiceClient.getWorkspaceSetting({ name: `${workspaceSettingNamePrefix}${settingKey}` });
    state.setPartial({
      settings: uniqBy([setting, ...state.settings], "name"),
    });
  };

  const upsertWorkspaceSetting = async (setting: WorkspaceSetting) => {
    await workspaceServiceClient.updateWorkspaceSetting({ setting });
    state.setPartial({
      settings: uniqBy([setting, ...state.settings], "name"),
    });
  };

  const updateWorkspaceSetting = async (setting: WorkspaceSetting) => {
    const response = await workspaceServiceClient.updateWorkspaceSetting({ setting });
    state.setPartial({
      settings: uniqBy([response, ...state.settings], "name"),
    });
    return response;
  };

  const getWorkspaceSettingByKey = (settingKey: WorkspaceSetting_Key) => {
    return (
      state.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${settingKey}`) || WorkspaceSetting.fromPartial({})
    );
  };

  const setTheme = async (theme: string) => {
    state.setPartial({ theme });

    // Update the workspace setting - store theme in a custom field or handle differently
    const generalSetting = state.generalSetting;
    const updatedGeneralSetting = WorkspaceSetting_GeneralSetting.fromPartial({
      ...generalSetting,
      customProfile: {
        ...generalSetting.customProfile,
      },
    });

    await upsertWorkspaceSetting(
      WorkspaceSetting.fromPartial({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`,
        generalSetting: updatedGeneralSetting,
      }),
    );
  };

  return {
    state,
    fetchWorkspaceSetting,
    upsertWorkspaceSetting,
    updateWorkspaceSetting,
    getWorkspaceSettingByKey,
    setTheme,
  };
})();

export const initialWorkspaceStore = async () => {
  const workspaceProfile = await workspaceServiceClient.getWorkspaceProfile({});

  // Set profile first to check if we have an owner
  workspaceStore.state.setPartial({
    profile: workspaceProfile,
  });

  // Only fetch settings that don't require special permissions when no owner exists
  const settingsToFetch = [WorkspaceSetting_Key.GENERAL, WorkspaceSetting_Key.MEMO_RELATED];

  // Only fetch AI setting if we have an owner (HOST user)
  if (workspaceProfile.owner) {
    settingsToFetch.push(WorkspaceSetting_Key.AI);
  }

  // Prepare workspace settings.
  for (const key of settingsToFetch) {
    try {
      await workspaceStore.fetchWorkspaceSetting(key);
    } catch (error) {
      console.warn(`Failed to fetch workspace setting ${key}:`, error);
      // Continue with other settings even if one fails
    }
  }

  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  workspaceStore.state.setPartial({
    locale: workspaceGeneralSetting.customProfile?.locale,
    theme: "default",
    profile: workspaceProfile,
  });
};

export default workspaceStore;
