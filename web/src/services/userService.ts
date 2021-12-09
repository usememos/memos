import api from "../helpers/api";
import appStore from "../stores/appStore";

class UserService {
  public getState() {
    return appStore.getState().userState;
  }

  public async doSignIn() {
    const { data: user } = await api.getUserInfo();
    if (user) {
      appStore.dispatch({
        type: "SIGN_IN",
        payload: { user },
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
    const { data: isUsable } = await api.checkUsernameUsable(username);
    return isUsable;
  }

  public async updateUsername(username: string): Promise<void> {
    await api.updateUserinfo(username);
  }

  public async removeGithubName(): Promise<void> {
    await api.updateUserinfo(undefined, undefined, "");
  }

  public async checkPasswordValid(password: string): Promise<boolean> {
    const { data: isValid } = await api.checkPasswordValid(password);
    return isValid;
  }

  public async updatePassword(password: string): Promise<void> {
    await api.updateUserinfo(undefined, password);
  }

  public async updateWxOpenId(wxOpenId: string): Promise<void> {
    await api.updateUserinfo(undefined, undefined, undefined, wxOpenId);
  }
}

const userService = new UserService();

export default userService;
