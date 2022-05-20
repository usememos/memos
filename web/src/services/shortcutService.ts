import userService from "./userService";
import api from "../helpers/api";
import appStore from "../stores/appStore";
import { UNKNOWN_ID } from "../helpers/consts";

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

  public getShortcutById(id: ShortcutId) {
    if (id === UNKNOWN_ID) {
      return null;
    }

    for (const s of this.getState().shortcuts) {
      if (s.id === id) {
        return s;
      }
    }

    return null;
  }

  public pushShortcut(shortcut: Shortcut) {
    appStore.dispatch({
      type: "INSERT_SHORTCUT",
      payload: {
        shortcut: {
          ...shortcut,
        },
      },
    });
  }

  public editShortcut(shortcut: Shortcut) {
    appStore.dispatch({
      type: "UPDATE_SHORTCUT",
      payload: shortcut,
    });
  }

  public async deleteShortcut(shortcutId: ShortcutId) {
    await api.deleteShortcutById(shortcutId);
    appStore.dispatch({
      type: "DELETE_SHORTCUT_BY_ID",
      payload: {
        id: shortcutId,
      },
    });
  }

  public async createShortcut(title: string, payload: string) {
    const data = await api.createShortcut(title, payload);
    return data;
  }

  public async updateShortcut(shortcutId: ShortcutId, title: string, payload: string) {
    const data = await api.updateShortcut(shortcutId, title, payload);
    return data;
  }

  public async pinShortcut(shortcutId: ShortcutId) {
    await api.pinShortcut(shortcutId);
  }

  public async unpinShortcut(shortcutId: ShortcutId) {
    await api.unpinShortcut(shortcutId);
  }

  public convertResponseModelShortcut(shortcut: Shortcut): Shortcut {
    return {
      ...shortcut,
      createdTs: shortcut.createdTs * 1000,
      updatedTs: shortcut.updatedTs * 1000,
    };
  }
}

const shortcutService = new ShortcutService();

export default shortcutService;
