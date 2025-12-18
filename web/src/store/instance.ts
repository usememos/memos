// Instance Store - manages instance-level configuration and settings
import { create } from "@bufbuild/protobuf";
import { uniqBy } from "lodash-es";
import { computed } from "mobx";
import { instanceServiceClient } from "@/connect";
import {
  InstanceProfile,
  InstanceProfileSchema,
  InstanceSetting,
  InstanceSetting_GeneralSetting,
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { createServerStore, StandardState } from "./base-store";
import { buildInstanceSettingName, getInstanceSettingKeyName, instanceSettingNamePrefix } from "./common";
import { createRequestKey } from "./store-utils";

class InstanceState extends StandardState {
  profile: InstanceProfile = create(InstanceProfileSchema, {});
  settings: InstanceSetting[] = [];

  // Computed property for general settings (memoized)
  get generalSetting(): InstanceSetting_GeneralSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}GENERAL`);
      if (setting?.value.case === "generalSetting") {
        return setting.value.value;
      }
      return create(InstanceSetting_GeneralSettingSchema, {});
    }).get();
  }

  // Computed property for memo-related settings (memoized)
  get memoRelatedSetting(): InstanceSetting_MemoRelatedSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}MEMO_RELATED`);
      if (setting?.value.case === "memoRelatedSetting") {
        return setting.value.value;
      }
      return create(InstanceSetting_MemoRelatedSettingSchema, {});
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
          name: buildInstanceSettingName(settingKey),
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
    const setting = state.settings.find((s) => s.name === buildInstanceSettingName(settingKey));
    return setting || create(InstanceSettingSchema, {});
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
