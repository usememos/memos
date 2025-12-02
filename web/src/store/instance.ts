// Instance Store - manages instance-level configuration and settings
import { uniqBy } from "lodash-es";
import { computed } from "mobx";
import { instanceServiceClient } from "@/grpcweb";
import {
  InstanceProfile,
  InstanceSetting,
  InstanceSetting_GeneralSetting,
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
} from "@/types/proto/api/v1/instance_service";
import { createServerStore, StandardState } from "./base-store";
import { instanceSettingNamePrefix } from "./common";
import { createRequestKey } from "./store-utils";

class InstanceState extends StandardState {
  profile: InstanceProfile = InstanceProfile.fromPartial({});
  settings: InstanceSetting[] = [];

  // Computed property for general settings (memoized)
  get generalSetting(): InstanceSetting_GeneralSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}${InstanceSetting_Key.GENERAL}`);
      return setting?.generalSetting || InstanceSetting_GeneralSetting.fromPartial({});
    }).get();
  }

  // Computed property for memo-related settings (memoized)
  get memoRelatedSetting(): InstanceSetting_MemoRelatedSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}${InstanceSetting_Key.MEMO_RELATED}`);
      return setting?.memoRelatedSetting || InstanceSetting_MemoRelatedSetting.fromPartial({});
    }).get();
  }
}

const instanceStore = (() => {
  const base = createServerStore(new InstanceState(), {
    name: "instance",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  const fetchInstanceSetting = async (settingKey: InstanceSetting_Key): Promise<void> => {
    const requestKey = createRequestKey("fetchInstanceSetting", { key: settingKey });

    return executeRequest(
      requestKey,
      async () => {
        const setting = await instanceServiceClient.getInstanceSetting({
          name: `${instanceSettingNamePrefix}${settingKey}`,
        });

        // Merge into settings array, avoiding duplicates
        state.setPartial({
          settings: uniqBy([setting, ...state.settings], "name"),
        });
      },
      "FETCH_INSTANCE_SETTING_FAILED",
    );
  };

  const upsertInstanceSetting = async (setting: InstanceSetting): Promise<void> => {
    return executeRequest(
      "", // No deduplication for updates
      async () => {
        await instanceServiceClient.updateInstanceSetting({ setting });

        // Update local state
        state.setPartial({
          settings: uniqBy([setting, ...state.settings], "name"),
        });
      },
      "UPDATE_INSTANCE_SETTING_FAILED",
    );
  };

  const getInstanceSettingByKey = (settingKey: InstanceSetting_Key): InstanceSetting => {
    const setting = state.settings.find((s) => s.name === `${instanceSettingNamePrefix}${settingKey}`);
    return setting || InstanceSetting.fromPartial({});
  };

  const fetchInstanceProfile = async (): Promise<InstanceProfile> => {
    const requestKey = createRequestKey("fetchInstanceProfile");

    return executeRequest(
      requestKey,
      async () => {
        const profile = await instanceServiceClient.getInstanceProfile({});
        state.setPartial({ profile });
        return profile;
      },
      "FETCH_INSTANCE_PROFILE_FAILED",
    );
  };

  return {
    state,
    fetchInstanceSetting,
    fetchInstanceProfile,
    upsertInstanceSetting,
    getInstanceSettingByKey,
  };
})();

// Initialize the instance store - called once at app startup
export const initialInstanceStore = async (): Promise<void> => {
  try {
    // Fetch instance profile
    const instanceProfile = await instanceStore.fetchInstanceProfile();

    // Fetch required settings
    await Promise.all([
      instanceStore.fetchInstanceSetting(InstanceSetting_Key.GENERAL),
      instanceStore.fetchInstanceSetting(InstanceSetting_Key.MEMO_RELATED),
    ]);

    // Apply settings to state
    Object.assign(instanceStore.state, { profile: instanceProfile });
  } catch (error) {
    console.error("Failed to initialize instance store:", error);
  }
};

export default instanceStore;
