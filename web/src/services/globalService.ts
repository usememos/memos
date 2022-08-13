import store from "../store";
import * as api from "../helpers/api";
import { setLocale } from "../store/modules/global";
import { setHost, setOwner, setUser } from "../store/modules/user";
import userService, { convertResponseModelUser } from "./userService";

const globalService = {
  getState: () => {
    return store.getState().global;
  },

  initialState: async () => {
    const {
      data: { host },
    } = (await api.getSystemStatus()).data;
    if (host) {
      store.dispatch(setHost(convertResponseModelUser(host)));
    }

    const ownerUserId = userService.getUserIdFromPath();
    if (ownerUserId) {
      const { data: owner } = (await api.getUserById(ownerUserId)).data;
      if (owner) {
        store.dispatch(setOwner(convertResponseModelUser(owner)));
      }
    }

    const { data: user } = (await api.getMyselfUser()).data;
    if (user) {
      store.dispatch(setUser(convertResponseModelUser(user)));
    }
  },

  setLocale: (locale: Locale) => {
    store.dispatch(setLocale(locale));
  },
};

export default globalService;
