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
      additionalStyle: "",
      additionalScript: "",
      customizedProfile: {
        name: "memos",
        iconUrl: "https://usememos.com/logo.webp",
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
      defaultGlobalState.systemStatus = data;
      defaultGlobalState.locale = data.customizedProfile.locale;
      defaultGlobalState.appearance = data.customizedProfile.appearance;
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
