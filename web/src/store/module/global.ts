import * as api from "@/helpers/api";
import storage from "@/helpers/storage";
import i18n from "@/i18n";
import { findNearestLanguageMatch } from "@/utils/i18n";
import store, { useAppSelector } from "../";
import { setAppearance, setGlobalState, setLocale } from "../reducer/global";

export const initialGlobalState = async () => {
  const defaultGlobalState = {
    locale: "en" as Locale,
    appearance: "system" as Appearance,
    systemStatus: {
      allowSignUp: false,
      disablePublicMemos: false,
      maxUploadSizeMiB: 0,
      autoBackupInterval: 0,
      additionalStyle: "",
      additionalScript: "",
      memoDisplayWithUpdatedTs: false,
      customizedProfile: {
        name: "memos",
        logoUrl: "/logo.webp",
        description: "",
        locale: "en",
        appearance: "system",
        externalUrl: "",
      },
    } as SystemStatus,
  };

  const { locale: storageLocale, appearance: storageAppearance } = storage.get(["locale", "appearance"]);
  if (storageLocale) {
    defaultGlobalState.locale = storageLocale;
  }
  if (storageAppearance) {
    defaultGlobalState.appearance = storageAppearance;
  }

  const { data } = await api.getSystemStatus();
  if (data) {
    const customizedProfile = data.customizedProfile;
    defaultGlobalState.systemStatus = {
      ...data,
      customizedProfile: {
        name: customizedProfile.name || "memos",
        logoUrl: customizedProfile.logoUrl || "/logo.webp",
        description: customizedProfile.description,
        locale: customizedProfile.locale || "en",
        appearance: customizedProfile.appearance || "system",
        externalUrl: "",
      },
    };
    defaultGlobalState.locale =
      storageLocale || defaultGlobalState.systemStatus.customizedProfile.locale || findNearestLanguageMatch(i18n.language);
    defaultGlobalState.appearance = defaultGlobalState.systemStatus.customizedProfile.appearance;
  }
  store.dispatch(setGlobalState(defaultGlobalState));
};

export const useGlobalStore = () => {
  const state = useAppSelector((state) => state.global);

  return {
    state,
    getState: () => {
      return store.getState().global;
    },
    getDisablePublicMemos: () => {
      return store.getState().global.systemStatus.disablePublicMemos;
    },
    isDev: () => {
      return state.systemStatus.profile.mode !== "prod";
    },
    fetchSystemStatus: async () => {
      const { data: systemStatus } = await api.getSystemStatus();
      store.dispatch(setGlobalState({ systemStatus: systemStatus }));
      return systemStatus;
    },
    setSystemStatus: (systemStatus: Partial<SystemStatus>) => {
      store.dispatch(
        setGlobalState({
          systemStatus: {
            ...state.systemStatus,
            ...systemStatus,
          },
        })
      );
    },
    setLocale: (locale: Locale) => {
      store.dispatch(setLocale(locale));
    },
    setAppearance: (appearance: Appearance) => {
      store.dispatch(setAppearance(appearance));
    },
  };
};
