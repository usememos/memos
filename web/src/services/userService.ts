import api from "../helpers/api";
import utils from "../helpers/utils";
import appStore from "../stores/appStore";

class UserService {
  public getState() {
    return appStore.getState().userState;
  }

  public async doSignIn() {
    const user = await api.getUserInfo();
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

  public async checkUsernameUsable(username: string): Promise<boolean> {
    const isUsable = await api.checkUsernameUsable(username);
    return isUsable;
  }

  public async updateUsername(name: string): Promise<void> {
    await api.updateUserinfo({
      name,
    });
  }

  public async checkPasswordValid(password: string): Promise<boolean> {
    const isValid = await api.checkPasswordValid(password);
    return isValid;
  }

  public async updatePassword(password: string): Promise<void> {
    await api.updateUserinfo({
      password,
    });
  }

  public async resetOpenId(): Promise<string> {
    const openId = await api.resetOpenId();
    appStore.dispatch({
      type: "RESET_OPENID",
      payload: openId,
    });
    return openId;
  }

  private convertResponseModelUser(user: Model.User): Model.User {
    return {
      ...user,
      createdAt: utils.getDataStringWithTs(user.createdTs),
      updatedAt: utils.getDataStringWithTs(user.updatedTs),
    };
  }
}

const userService = new UserService();

export default userService;
