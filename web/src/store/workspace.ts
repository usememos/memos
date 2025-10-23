/**
 * Workspace Store
 *
 * Manages workspace-level configuration and settings.
 * This is a server state store that fetches workspace profile and settings.
 */
import { uniqBy } from "lodash-es";
import { computed } from "mobx";
import { workspaceServiceClient } from "@/grpcweb";
import { WorkspaceProfile, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import {
  WorkspaceSetting_GeneralSetting,
  WorkspaceSetting_MemoRelatedSetting,
  WorkspaceSetting,
} from "@/types/proto/api/v1/workspace_service";
import { isValidateLocale } from "@/utils/i18n";
import { StandardState, createServerStore } from "./base-store";
import { workspaceSettingNamePrefix } from "./common";
import { createRequestKey } from "./store-utils";

/**
 * Valid theme options
 */
const VALID_THEMES = ["default", "default-dark", "paper", "whitewall"] as const;
export type Theme = (typeof VALID_THEMES)[number];

/**
 * Check if a string is a valid theme
 */
export function isValidTheme(theme: string): theme is Theme {
  return VALID_THEMES.includes(theme as Theme);
}

/**
 * Workspace store state
 */
class WorkspaceState extends StandardState {
  /**
   * Current locale (e.g., "en", "zh", "ja")
   */
  locale: string = "en";

  /**
   * Current theme
   * Note: Accepts string for flexibility, but validates to Theme
   */
  theme: Theme | string = "default";

  /**
   * Workspace profile containing owner and metadata
   */
  profile: WorkspaceProfile = WorkspaceProfile.fromPartial({});

  /**
   * Array of workspace settings
   */
  settings: WorkspaceSetting[] = [];

  /**
   * Computed property for general settings
   * Memoized for performance
   */
  get generalSetting(): WorkspaceSetting_GeneralSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`);
      return setting?.generalSetting || WorkspaceSetting_GeneralSetting.fromPartial({});
    }).get();
  }

  /**
   * Computed property for memo-related settings
   * Memoized for performance
   */
  get memoRelatedSetting(): WorkspaceSetting_MemoRelatedSetting {
    return computed(() => {
      const setting = this.settings.find((s) => s.name === `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.MEMO_RELATED}`);
      return setting?.memoRelatedSetting || WorkspaceSetting_MemoRelatedSetting.fromPartial({});
    }).get();
  }

  /**
   * Override setPartial to validate locale and theme
   */
  setPartial(partial: Partial<WorkspaceState>): void {
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
 * Workspace store instance
 */
const workspaceStore = (() => {
  const base = createServerStore(new WorkspaceState(), {
    name: "workspace",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  /**
   * Fetch a specific workspace setting by key
   *
   * @param settingKey - The setting key to fetch
   */
  const fetchWorkspaceSetting = async (settingKey: WorkspaceSetting_Key): Promise<void> => {
    const requestKey = createRequestKey("fetchWorkspaceSetting", { key: settingKey });

    return executeRequest(
      requestKey,
      async () => {
        const setting = await workspaceServiceClient.getWorkspaceSetting({
          name: `${workspaceSettingNamePrefix}${settingKey}`,
        });

        // Merge into settings array, avoiding duplicates
        state.setPartial({
          settings: uniqBy([setting, ...state.settings], "name"),
        });
      },
      "FETCH_WORKSPACE_SETTING_FAILED",
    );
  };

  /**
   * Update or create a workspace setting
   *
   * @param setting - The setting to upsert
   */
  const upsertWorkspaceSetting = async (setting: WorkspaceSetting): Promise<void> => {
    return executeRequest(
      "", // No deduplication for updates
      async () => {
        await workspaceServiceClient.updateWorkspaceSetting({ setting });

        // Update local state
        state.setPartial({
          settings: uniqBy([setting, ...state.settings], "name"),
        });
      },
      "UPDATE_WORKSPACE_SETTING_FAILED",
    );
  };

  /**
   * Get a workspace setting from cache by key
   * Does not trigger a fetch
   *
   * @param settingKey - The setting key
   * @returns The cached setting or an empty setting
   */
  const getWorkspaceSettingByKey = (settingKey: WorkspaceSetting_Key): WorkspaceSetting => {
    const setting = state.settings.find((s) => s.name === `${workspaceSettingNamePrefix}${settingKey}`);
    return setting || WorkspaceSetting.fromPartial({});
  };

  /**
   * Set the workspace theme
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

  /**
   * Fetch workspace profile
   */
  const fetchWorkspaceProfile = async (): Promise<WorkspaceProfile> => {
    const requestKey = createRequestKey("fetchWorkspaceProfile");

    return executeRequest(
      requestKey,
      async () => {
        const profile = await workspaceServiceClient.getWorkspaceProfile({});
        state.setPartial({ profile });
        return profile;
      },
      "FETCH_WORKSPACE_PROFILE_FAILED",
    );
  };

  return {
    state,
    fetchWorkspaceSetting,
    fetchWorkspaceProfile,
    upsertWorkspaceSetting,
    getWorkspaceSettingByKey,
    setTheme,
  };
})();

/**
 * Initialize the workspace store
 * Called once at app startup to load workspace profile and settings
 *
 * @throws Never - errors are logged but not thrown
 */
export const initialWorkspaceStore = async (): Promise<void> => {
  try {
    // Fetch workspace profile
    const workspaceProfile = await workspaceStore.fetchWorkspaceProfile();

    // Fetch required settings
    await Promise.all([
      workspaceStore.fetchWorkspaceSetting(WorkspaceSetting_Key.GENERAL),
      workspaceStore.fetchWorkspaceSetting(WorkspaceSetting_Key.MEMO_RELATED),
    ]);

    // Apply settings to state
    const workspaceGeneralSetting = workspaceStore.state.generalSetting;
    workspaceStore.state.setPartial({
      locale: workspaceGeneralSetting.customProfile?.locale || "en",
      theme: "default",
      profile: workspaceProfile,
    });
  } catch (error) {
    console.error("Failed to initialize workspace store:", error);
    // Set default fallback values
    workspaceStore.state.setPartial({
      locale: "en",
      theme: "default",
    });
  }
};

export default workspaceStore;
