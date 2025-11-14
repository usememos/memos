/**
 * Instance Store
 *
 * Manages instance-level configuration and settings.
 * This is a server state store that fetches instance profile and settings.
 */
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
import { isValidateLocale } from "@/utils/i18n";
import { createServerStore, StandardState } from "./base-store";
import { instanceSettingNamePrefix } from "./common";
import { createRequestKey } from "./store-utils";

/**
 * Valid theme options
 */
const VALID_THEMES = ["system", "default", "default-dark", "paper", "whitewall"] as const;
export type Theme = (typeof VALID_THEMES)[number];

/**
 * Check if a string is a valid theme
 */
export function isValidTheme(theme: string): theme is Theme {
  return VALID_THEMES.includes(theme as Theme);
}

/**
 * Instance store state
 */
class InstanceState extends StandardState {
  /**
   * Current locale (e.g., "en", "zh", "ja")
   */
  locale: string = "en";

  /**
   * Current theme
   * Note: Accepts string for flexibility, but validates to Theme
   */
  theme: Theme | string = "system";

  /**
   * Instance profile containing owner and metadata
   */
  profile: InstanceProfile = InstanceProfile.fromPartial({});

  /**
   * Array of instance settings
   */
  settings: InstanceSetting[] = [];

  /**
   * Computed property for general settings
   * Memoized for performance
   */
  get generalSetting(): InstanceSetting_GeneralSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}${InstanceSetting_Key.GENERAL}`);
      return setting?.generalSetting || InstanceSetting_GeneralSetting.fromPartial({});
    }).get();
  }

  /**
   * Computed property for memo-related settings
   * Memoized for performance
   */
  get memoRelatedSetting(): InstanceSetting_MemoRelatedSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${instanceSettingNamePrefix}${InstanceSetting_Key.MEMO_RELATED}`);
      return setting?.memoRelatedSetting || InstanceSetting_MemoRelatedSetting.fromPartial({});
    }).get();
  }

  /**
   * Override setPartial to validate locale and theme
   */
  setPartial(partial: Partial<InstanceState>): void {
    const finalState = { ...this, ...partial };

    // Validate locale
    if (partial.locale !== undefined && !isValidateLocale(finalState.locale)) {
      console.warn(`Invalid locale "${finalState.locale}", falling back to "en"`);
      finalState.locale = "en";
    }

    // Validate theme - accept string and validate
    if (partial.theme !== undefined) {
      const themeStr = String(finalState.theme);
      if (!isValidTheme(themeStr)) {
        console.warn(`Invalid theme "${themeStr}", falling back to "default"`);
        finalState.theme = "default";
      } else {
        finalState.theme = themeStr;
      }
    }

    Object.assign(this, finalState);
  }
}

/**
 * Instance store instance
 */
const instanceStore = (() => {
  const base = createServerStore(new InstanceState(), {
    name: "instance",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  /**
   * Fetch a specific instance setting by key
   *
   * @param settingKey - The setting key to fetch
   */
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

  /**
   * Update or create an instance setting
   *
   * @param setting - The setting to upsert
   */
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

  /**
   * Get an instance setting from cache by key
   * Does not trigger a fetch
   *
   * @param settingKey - The setting key
   * @returns The cached setting or an empty setting
   */
  const getInstanceSettingByKey = (settingKey: InstanceSetting_Key): InstanceSetting => {
    const setting = state.settings.find((s) => s.name === `${instanceSettingNamePrefix}${settingKey}`);
    return setting || InstanceSetting.fromPartial({});
  };

  /**
   * Set the instance theme
   * Updates both local state and persists to server
   *
   * @param theme - The theme to set
   */
  const setTheme = async (theme: string): Promise<void> => {
    // Validate theme
    if (!isValidTheme(theme)) {
      console.warn(`Invalid theme "${theme}", ignoring`);
      return;
    }

    // Update local state immediately
    state.setPartial({ theme });

    // Persist to server
    const generalSetting = state.generalSetting;
    const updatedGeneralSetting = InstanceSetting_GeneralSetting.fromPartial({
      ...generalSetting,
      customProfile: {
        ...generalSetting.customProfile,
      },
    });

    await upsertInstanceSetting(
      InstanceSetting.fromPartial({
        name: `${instanceSettingNamePrefix}${InstanceSetting_Key.GENERAL}`,
        generalSetting: updatedGeneralSetting,
      }),
    );
  };

  /**
   * Fetch instance profile
   */
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
    setTheme,
  };
})();

/**
 * Initialize the instance store
 * Called once at app startup to load instance profile and settings
 *
 * @throws Never - errors are logged but not thrown
 */
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
    const instanceGeneralSetting = instanceStore.state.generalSetting;
    instanceStore.state.setPartial({
      locale: instanceGeneralSetting.customProfile?.locale || "en",
      theme: instanceGeneralSetting.theme || "system",
      profile: instanceProfile,
    });
  } catch (error) {
    console.error("Failed to initialize instance store:", error);
    // Set default fallback values
    instanceStore.state.setPartial({
      locale: "en",
      theme: "system",
    });
  }
};

export default instanceStore;
