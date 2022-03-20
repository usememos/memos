import userService from "./userService";
import api from "../helpers/api";
import appStore from "../stores/appStore";
import utils from "../helpers/utils";

class ShortcutService {
  public getState() {
    return appStore.getState().shortcutState;
  }

  public async getMyAllShortcuts() {
    if (!userService.getState().user) {
      return false;
    }

    const data = await api.getMyShortcuts();
    appStore.dispatch({
      type: "SET_SHORTCUTS",
      payload: {
        shortcuts: data.map((s) => this.convertResponseModelShortcut(s)),
      },
    });
    return data;
  }

  public getShortcutById(id: string) {
    for (const q of this.getState().shortcuts) {
      if (q.id === id) {
        return q;
      }
    }

    return null;
  }

  public pushShortcut(shortcut: Model.Shortcut) {
    appStore.dispatch({
      type: "INSERT_SHORTCUT",
      payload: {
        shortcut: {
          ...shortcut,
        },
      },
    });
  }

  public editShortcut(shortcut: Model.Shortcut) {
    appStore.dispatch({
      type: "UPDATE_SHORTCUT",
      payload: shortcut,
    });
  }

  public async deleteShortcut(shortcutId: string) {
    await api.deleteShortcutById(shortcutId);
    appStore.dispatch({
      type: "DELETE_SHORTCUT_BY_ID",
      payload: {
        id: shortcutId,
      },
    });
  }

  public async createShortcut(title: string, shortcutstring: string) {
    const data = await api.createShortcut(title, shortcutstring);
    return data;
  }

  public async updateShortcut(shortcutId: string, title: string, shortcutstring: string) {
    const data = await api.updateShortcut(shortcutId, title, shortcutstring);
    return data;
  }

  public async pinShortcut(shortcutId: string) {
    await api.pinShortcut(shortcutId);
  }

  public async unpinShortcut(shortcutId: string) {
    await api.unpinShortcut(shortcutId);
  }

  public convertResponseModelShortcut(shortcut: Model.Shortcut): Model.Shortcut {
    return {
      ...shortcut,
      id: String(shortcut.id),
      createdAt: utils.getDataStringWithTs(shortcut.createdTs),
      updatedAt: utils.getDataStringWithTs(shortcut.updatedTs),
    };
  }
}

const shortcutService = new ShortcutService();

export default shortcutService;
