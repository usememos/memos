import * as api from "../helpers/api";
import store from "../store";
import { setUser, patchUser } from "../store/modules/user";

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
    const { data: user } = (await api.getUser()).data;
    if (user) {
      store.dispatch(setUser(convertResponseModelUser(user)));
    } else {
      userService.doSignOut();
    }
    return user;
  },

  doSignOut: async () => {
    store.dispatch(setUser());
    await api.signout();
  },

  patchUser: async (userPatch: UserPatch): Promise<void> => {
    const { data } = (await api.patchUser(userPatch)).data;
    const user = convertResponseModelUser(data);
    store.dispatch(patchUser(user));
  },
};

export default userService;
