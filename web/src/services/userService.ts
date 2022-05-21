import api from "../helpers/api";
import { signin, signout } from "../store/modules/user";
import store from "../store";

const convertResponseModelUser = (user: User): User => {
  return {
    ...user,
    createdTs: user.createdTs * 1000,
    updatedTs: user.updatedTs * 1000,
  };
};

const userService = {
  getState: () => {
    return store.getState().user;
  },

  doSignIn: async () => {
    const user = await api.getUser();
    if (user) {
      store.dispatch(signin(convertResponseModelUser(user)));
    } else {
      userService.doSignOut();
    }
    return user;
  },

  doSignOut: async () => {
    store.dispatch(signout);
    api.signout().catch(() => {
      // do nth
    });
  },

  updateUsername: async (name: string): Promise<void> => {
    await api.patchUser({
      name,
    });
  },

  updatePassword: async (password: string): Promise<void> => {
    await api.patchUser({
      password,
    });
  },

  resetOpenId: async (): Promise<string> => {
    const user = await api.patchUser({
      resetOpenId: true,
    });
    return user.openId;
  },
};

export default userService;
