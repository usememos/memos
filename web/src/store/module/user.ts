import { camelCase } from "lodash-es";
import * as api from "@/helpers/api";
import storage from "@/helpers/storage";
import { getSystemColorScheme } from "@/helpers/utils";
import store, { useAppSelector } from "..";
import { setAppearance, setLocale } from "../reducer/global";
import { patchUser, setHost, setUser } from "../reducer/user";

const defaultSetting: Setting = {
  locale: "en",
  appearance: getSystemColorScheme(),
  memoVisibility: "PRIVATE",
  telegramUserId: "",
};

const defaultLocalSetting: LocalSetting = {
  enableDoubleClickEditing: false,
  dailyReviewTimeOffset: 0,
};

export const convertResponseModelUser = (user: User): User => {
  // user default 'Basic Setting' should follow server's setting
  // 'Basic Setting' fields: locale, appearance
  const { systemStatus } = store.getState().global;
  const { locale, appearance } = systemStatus.customizedProfile;
  const systemSetting = { locale, appearance };

  const setting: Setting = {
    ...defaultSetting,
    ...systemSetting,
  };
  const { localSetting: storageLocalSetting } = storage.get(["localSetting"]);
  const localSetting: LocalSetting = {
    ...defaultLocalSetting,
    ...storageLocalSetting,
  };

  if (user.userSettingList) {
    for (const userSetting of user.userSettingList) {
      (setting as any)[camelCase(userSetting.key)] = JSON.parse(userSetting.value);
    }
  }

  return {
    ...user,
    setting,
    localSetting,
    createdTs: user.createdTs * 1000,
    updatedTs: user.updatedTs * 1000,
  };
};

export const initialUserState = async () => {
  const { systemStatus } = store.getState().global;

  if (systemStatus.host) {
    store.dispatch(setHost(convertResponseModelUser(systemStatus.host)));
  }

  const { data } = await api.getMyselfUser();
  if (data) {
    const user = convertResponseModelUser(data);
    store.dispatch(setUser(user));
    if (user.setting.locale) {
      store.dispatch(setLocale(user.setting.locale));
    }
    if (user.setting.appearance) {
      store.dispatch(setAppearance(user.setting.appearance));
    }
    return user;
  }
};

const doSignIn = async () => {
  const { data: user } = await api.getMyselfUser();
  if (user) {
    store.dispatch(setUser(convertResponseModelUser(user)));
  } else {
    doSignOut();
  }
  return user;
};

const doSignOut = async () => {
  await api.signout();
};

export const useUserStore = () => {
  const state = useAppSelector((state) => state.user);

  return {
    state,
    getState: () => {
      return store.getState().user;
    },
    doSignIn,
    doSignOut,
    upsertUserSetting: async (key: string, value: any) => {
      await api.upsertUserSetting({
        key: key as any,
        value: JSON.stringify(value),
      });
      await doSignIn();
    },
    upsertLocalSetting: async (localSetting: LocalSetting) => {
      storage.set({ localSetting });
      store.dispatch(patchUser({ localSetting }));
    },
    patchUser: async (userPatch: UserPatch): Promise<void> => {
      await api.patchUser(userPatch);
      // If the user is the current user and the username is changed, reload the page.
      if (userPatch.id === store.getState().user.user?.id && userPatch.username) {
        window.location.reload();
      }
    },
    deleteUser: async (userDelete: UserDelete) => {
      await api.deleteUser(userDelete);
    },
  };
};
