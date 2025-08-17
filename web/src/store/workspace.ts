import { uniqBy } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { workspaceServiceClient } from "@/grpcweb";
import { WorkspaceProfile, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import {
  WorkspaceSetting_GeneralSetting,
  WorkspaceSetting_MemoRelatedSetting,
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
    getWorkspaceSettingByKey,
    setTheme,
  };
})();

export const initialWorkspaceStore = async () => {
  const workspaceProfile = await workspaceServiceClient.getWorkspaceProfile({});
  // Prepare workspace settings.
  for (const key of [WorkspaceSetting_Key.GENERAL, WorkspaceSetting_Key.MEMO_RELATED]) {
    await workspaceStore.fetchWorkspaceSetting(key);
  }

  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  workspaceStore.state.setPartial({
    locale: workspaceGeneralSetting.customProfile?.locale,
    theme: "default",
    profile: workspaceProfile,
  });
};

export default workspaceStore;
