import { makeAutoObservable } from "mobx";
import { workspaceServiceClient, workspaceSettingServiceClient } from "@/grpcweb";
import { WorkspaceProfile } from "@/types/proto/api/v1/workspace_service";
import { WorkspaceGeneralSetting, WorkspaceSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { isValidateLocale } from "@/utils/i18n";
import { workspaceSettingNamePrefix } from "../v1";

interface LocalState {
  locale: string;
  appearance: string;
  profile: WorkspaceProfile;
  settings: WorkspaceSetting[];
}

const workspaceStore = (() => {
  const state = makeAutoObservable<LocalState>({
    locale: "en",
    appearance: "system",
    profile: WorkspaceProfile.fromPartial({}),
    settings: [],
  });

  const generalSetting =
    state.settings.find((setting) => setting.name === `${workspaceSettingNamePrefix}${WorkspaceSettingKey.GENERAL}`)?.generalSetting ||
    WorkspaceGeneralSetting.fromPartial({});

  const setPartial = (partial: Partial<LocalState>) => {
    Object.assign(state, partial);
  };

  const fetchWorkspaceSetting = async (settingKey: WorkspaceSettingKey) => {
    const setting = await workspaceSettingServiceClient.getWorkspaceSetting({ name: `${workspaceSettingNamePrefix}${settingKey}` });
    state.settings.push(setting);
  };

  return {
    state,
    generalSetting,
    setPartial,
    fetchWorkspaceSetting,
  };
})();

export const initialWorkspaceStore = async () => {
  const workspaceProfile = await workspaceServiceClient.getWorkspaceProfile({});
  // Prepare workspace settings.
  for (const key of [WorkspaceSettingKey.GENERAL, WorkspaceSettingKey.MEMO_RELATED]) {
    await workspaceStore.fetchWorkspaceSetting(key);
  }

  const workspaceGeneralSetting = workspaceStore.generalSetting;
  let locale = workspaceGeneralSetting.customProfile?.locale;
  if (!isValidateLocale(locale)) {
    locale = "en";
  }
  let appearance = workspaceGeneralSetting.customProfile?.appearance;
  if (!appearance || !["system", "light", "dark"].includes(appearance)) {
    appearance = "system";
  }
  workspaceStore.setPartial({
    locale: locale,
    appearance: appearance,
    profile: workspaceProfile,
  });
};

export default workspaceStore;
