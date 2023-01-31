import * as api from "../../helpers/api";
import * as storage from "../../helpers/storage";
import store, { useAppSelector } from "../";
import { setAppearance, setGlobalState, setLocale } from "../reducer/global";

export const initialGlobalState = async () => {
  const defaultGlobalState = {
    locale: "en" as Locale,
    appearance: "system" as Appearance,
    systemStatus: {
      allowSignUp: false,
      disablePublicMemos: false,
      additionalStyle: "",
      additionalScript: "",
      customizedProfile: {
        name: "memos",
        logoUrl: "/logo.png",
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

  try {
    const { data } = (await api.getSystemStatus()).data;
    if (data) {
      const customizedProfile = data.customizedProfile;
      defaultGlobalState.systemStatus = {
        ...data,
        customizedProfile: {
          name: customizedProfile.name || "memos",
          logoUrl: customizedProfile.logoUrl || "/logo.png",
          description: customizedProfile.description,
          locale: customizedProfile.locale || "en",
          appearance: customizedProfile.appearance || "system",
          externalUrl: "",
        },
      };
      defaultGlobalState.locale = customizedProfile.locale;
      defaultGlobalState.appearance = customizedProfile.appearance;
    }
  } catch (error) {
    // do nth
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
    fetchSystemStatus: async () => {
      const { data: systemStatus } = (await api.getSystemStatus()).data;
      store.dispatch(setGlobalState({ systemStatus: systemStatus }));
      return systemStatus;
    },
    setLocale: (locale: Locale) => {
      store.dispatch(setLocale(locale));
    },
    setAppearance: (appearance: Appearance) => {
      store.dispatch(setAppearance(appearance));
    },
  };
};
