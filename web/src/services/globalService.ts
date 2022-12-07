import store from "../store";
import * as api from "../helpers/api";
import * as storage from "../helpers/storage";
import { setAppearance, setGlobalState, setLocale, pushDialogStack, popDialogStack } from "../store/modules/global";

const globalService = {
  getState: () => {
    return store.getState().global;
  },

  initialState: async () => {
    const defaultGlobalState = {
      locale: "en" as Locale,
      appearance: "system" as Appearance,
      systemStatus: {
        allowSignUp: false,
        additionalStyle: "",
        additionalScript: "",
      } as SystemStatus,
      dialogStack: [],
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
      }
    } catch (error) {
      // do nth
    }

    store.dispatch(setGlobalState(defaultGlobalState));
  },

  setLocale: (locale: Locale) => {
    store.dispatch(setLocale(locale));
  },

  setAppearance: (appearance: Appearance) => {
    store.dispatch(setAppearance(appearance));
  },

  pushDialogStack: (name: string) => {
    store.dispatch(pushDialogStack(name));
  },

  popDialogStack: () => {
    store.dispatch(popDialogStack());
  },

  topDialogStack: () => {
    const stack = store.getState().global.dialogStack;
    return stack[stack.length - 1];
  },
};

export default globalService;
