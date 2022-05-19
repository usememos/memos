import api from "../helpers/api";
import appStore from "../stores/appStore";

class UserService {
  public getState() {
    return appStore.getState().userState;
  }

  public async doSignIn() {
    const user = await api.getUser();
    if (user) {
      appStore.dispatch({
        type: "LOGIN",
        payload: {
          user: this.convertResponseModelUser(user),
        },
      });
    } else {
      userService.doSignOut();
    }
    return user;
  }

  public async doSignOut() {
    appStore.dispatch({
      type: "SIGN_OUT",
      payload: null,
    });
    api.signout().catch(() => {
      // do nth
    });
  }

  public async updateUsername(name: string): Promise<void> {
    await api.patchUser({
      name,
    });
  }

  public async updatePassword(password: string): Promise<void> {
    await api.patchUser({
      password,
    });
  }

  public async resetOpenId(): Promise<string> {
    const user = await api.patchUser({
      resetOpenId: true,
    });
    appStore.dispatch({
      type: "RESET_OPENID",
      payload: user.openId,
    });
    return user.openId;
  }

  private convertResponseModelUser(user: User): User {
    return {
      ...user,
      createdTs: user.createdTs * 1000,
      updatedTs: user.updatedTs * 1000,
    };
  }
}

const userService = new UserService();

export default userService;
