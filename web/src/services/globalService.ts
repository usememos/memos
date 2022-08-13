import store from "../store";
import * as api from "../helpers/api";
import * as storage from "../helpers/storage";
import { setGlobalState, setLocale } from "../store/modules/global";
import { convertResponseModelUser } from "./userService";

const globalService = {
  getState: () => {
    return store.getState().global;
  },

  initialState: async () => {
    const defaultGlobalState = {
      locale: "en" as Locale,
    };

    const { locale: storageLocale } = storage.get(["locale"]);
    if (storageLocale) {
      defaultGlobalState.locale = storageLocale;
    }
    try {
      const { data } = (await api.getMyselfUser()).data;
      if (data) {
        const user = convertResponseModelUser(data);
        if (user.setting.locale) {
          defaultGlobalState.locale = user.setting.locale;
        }
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
