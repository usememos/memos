import store from "../store";
import * as api from "../helpers/api";
import * as storage from "../helpers/storage";
import { setGlobalState, setLocale } from "../store/modules/global";

const globalService = {
  getState: () => {
    return store.getState().global;
  },

  initialState: async () => {
    const defaultGlobalState = {
      locale: "en" as Locale,
      systemStatus: {
        allowSignUp: false,
        additionalStyle: "",
        additionalScript: "",
      } as SystemStatus,
    };

    const { locale: storageLocale } = storage.get(["locale"]);
    if (storageLocale) {
      defaultGlobalState.locale = storageLocale;
    }

    try {
      const { data } = (await api.getSystemStatus()).data;
      if (data) {
        defaultGlobalState.systemStatus = data;
      }
    } catch (error) {
      // do nth
    }

    store.dispatch(setGlobalState(defaultGlobalState));
  },

  setLocale: (locale: Locale) => {
    store.dispatch(setLocale(locale));
  },
};

export default globalService;
