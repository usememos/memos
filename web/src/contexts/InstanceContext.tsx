import { create } from "@bufbuild/protobuf";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { instanceServiceClient } from "@/connect";
import { updateInstanceConfig } from "@/instance-config";
import {
  InstanceProfile,
  InstanceProfileSchema,
  InstanceSetting,
  InstanceSetting_GeneralSetting,
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSetting_StorageSetting,
  InstanceSetting_StorageSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";

const instanceSettingNamePrefix = "instance/settings/";

const buildInstanceSettingName = (key: InstanceSetting_Key): string => {
  const keyName = InstanceSetting_Key[key];
  return `${instanceSettingNamePrefix}${keyName}`;
};

interface InstanceState {
  profile: InstanceProfile;
  settings: InstanceSetting[];
  isInitialized: boolean;
  isLoading: boolean;
}

interface InstanceContextValue extends InstanceState {
  generalSetting: InstanceSetting_GeneralSetting;
  memoRelatedSetting: InstanceSetting_MemoRelatedSetting;
  storageSetting: InstanceSetting_StorageSetting;
  initialize: () => Promise<void>;
  fetchSetting: (key: InstanceSetting_Key) => Promise<void>;
  updateSetting: (setting: InstanceSetting) => Promise<void>;
}

const InstanceContext = createContext<InstanceContextValue | null>(null);

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InstanceState>({
    profile: create(InstanceProfileSchema, {}),
    settings: [],
    isInitialized: false,
    isLoading: true,
  });

  // Memoize derived settings to prevent unnecessary recalculations
  const generalSetting = useMemo((): InstanceSetting_GeneralSetting => {
    const setting = state.settings.find((s) => s.name === `${instanceSettingNamePrefix}GENERAL`);
    if (setting?.value.case === "generalSetting") {
      return setting.value.value;
    }
    return create(InstanceSetting_GeneralSettingSchema, {});
  }, [state.settings]);

  const memoRelatedSetting = useMemo((): InstanceSetting_MemoRelatedSetting => {
    const setting = state.settings.find((s) => s.name === `${instanceSettingNamePrefix}MEMO_RELATED`);
    if (setting?.value.case === "memoRelatedSetting") {
      return setting.value.value;
    }
    return create(InstanceSetting_MemoRelatedSettingSchema, {});
  }, [state.settings]);

  const storageSetting = useMemo((): InstanceSetting_StorageSetting => {
    const setting = state.settings.find((s) => s.name === `${instanceSettingNamePrefix}STORAGE`);
    if (setting?.value.case === "storageSetting") {
      return setting.value.value;
    }
    return create(InstanceSetting_StorageSettingSchema, {});
  }, [state.settings]);

  const initialize = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const profile = await instanceServiceClient.getInstanceProfile({});

      const [generalSetting, memoRelatedSettingResponse] = await Promise.all([
        instanceServiceClient.getInstanceSetting({ name: buildInstanceSettingName(InstanceSetting_Key.GENERAL) }),
        instanceServiceClient.getInstanceSetting({ name: buildInstanceSettingName(InstanceSetting_Key.MEMO_RELATED) }),
      ]);

      // Update global config for non-React code (like connect.ts interceptors)
      if (memoRelatedSettingResponse.value.case === "memoRelatedSetting") {
        updateInstanceConfig({
          memoRelatedSetting: {
            disallowPublicVisibility: memoRelatedSettingResponse.value.value.disallowPublicVisibility,
          },
        });
      }

      setState({
        profile,
        settings: [generalSetting, memoRelatedSettingResponse],
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to initialize instance:", error);
      setState((prev) => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
      }));
    }
  }, []);

  const fetchSetting = useCallback(async (key: InstanceSetting_Key) => {
    const setting = await instanceServiceClient.getInstanceSetting({
      name: buildInstanceSettingName(key),
    });
    setState((prev) => ({
      ...prev,
      settings: [...prev.settings.filter((s) => s.name !== setting.name), setting],
    }));
  }, []);

  const updateSetting = useCallback(async (setting: InstanceSetting) => {
    await instanceServiceClient.updateInstanceSetting({ setting });
    setState((prev) => ({
      ...prev,
      settings: [...prev.settings.filter((s) => s.name !== setting.name), setting],
    }));
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      ...state,
      generalSetting,
      memoRelatedSetting,
      storageSetting,
      initialize,
      fetchSetting,
      updateSetting,
    }),
    [state, generalSetting, memoRelatedSetting, storageSetting, initialize, fetchSetting, updateSetting],
  );

  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

export function useInstance() {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error("useInstance must be used within InstanceProvider");
  }
  return context;
}
