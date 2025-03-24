import { uniqBy } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { workspaceServiceClient, workspaceSettingServiceClient } from "@/grpcweb";
import { WorkspaceProfile } from "@/types/proto/api/v1/workspace_service";
import { WorkspaceGeneralSetting, WorkspaceMemoRelatedSetting, WorkspaceSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { isValidateLocale } from "@/utils/i18n";
import { workspaceSettingNamePrefix } from "../v1";

class LocalState {
  locale: string = "en";
  appearance: string = "system";
  profile: WorkspaceProfile = WorkspaceProfile.fromPartial({});
  settings: WorkspaceSetting[] = [];

  get generalSetting() {
    return (
      this.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSettingKey.GENERAL}`)?.generalSetting ||
      WorkspaceGeneralSetting.fromPartial({})
    );
  }

  get memoRelatedSetting() {
    return (
      this.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSettingKey.MEMO_RELATED}`)
        ?.memoRelatedSetting || WorkspaceMemoRelatedSetting.fromPartial({})
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
    if (!["system", "light", "dark"].includes(finalState.appearance)) {
      finalState.appearance = "system";
    }
    Object.assign(this, finalState);
  }
}

const workspaceStore = (() => {
  const state = new LocalState();

  const fetchWorkspaceSetting = async (settingKey: WorkspaceSettingKey) => {
    const setting = await workspaceSettingServiceClient.getWorkspaceSetting({ name: `${workspaceSettingNamePrefix}${settingKey}` });
    state.setPartial({
      settings: uniqBy([setting, ...state.settings], "name"),
    });
  };

  const upsertWorkspaceSetting = async (setting: WorkspaceSetting) => {
    await workspaceSettingServiceClient.setWorkspaceSetting({ setting });
    state.setPartial({
      settings: uniqBy([setting, ...state.settings], "name"),
    });
  };

  const getWorkspaceSettingByKey = (settingKey: WorkspaceSettingKey) => {
    return (
      state.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${settingKey}`) || WorkspaceSetting.fromPartial({})
    );
  };

  return {
    state,
    fetchWorkspaceSetting,
    upsertWorkspaceSetting,
    getWorkspaceSettingByKey,
  };
})();

export const initialWorkspaceStore = async () => {
  const workspaceProfile = await workspaceServiceClient.getWorkspaceProfile({});
  // Prepare workspace settings.
  for (const key of [WorkspaceSettingKey.GENERAL, WorkspaceSettingKey.MEMO_RELATED]) {
    await workspaceStore.fetchWorkspaceSetting(key);
  }

  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  workspaceStore.state.setPartial({
    locale: workspaceGeneralSetting.customProfile?.locale,
    appearance: workspaceGeneralSetting.customProfile?.appearance,
    profile: workspaceProfile,
  });
};

export default workspaceStore;
