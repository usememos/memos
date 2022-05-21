import userService from "./userService";
import api from "../helpers/api";
import { UNKNOWN_ID } from "../helpers/consts";
import store from "../store/";
import { deleteShortcut, patchShortcut, setShortcuts } from "../store/modules/shortcut";

const convertResponseModelShortcut = (shortcut: Shortcut): Shortcut => {
  return {
    ...shortcut,
    createdTs: shortcut.createdTs * 1000,
    updatedTs: shortcut.updatedTs * 1000,
  };
};

const shortcutService = {
  getState: () => {
    return store.getState().shortcut;
  },

  getMyAllShortcuts: async () => {
    if (!userService.getState().user) {
      return false;
    }

    const data = await api.getMyShortcuts();
    const shortcuts = data.map((s) => convertResponseModelShortcut(s));
    store.dispatch(setShortcuts(shortcuts));
    return shortcuts;
  },

  getShortcutById: (id: ShortcutId) => {
    if (id === UNKNOWN_ID) {
      return null;
    }

    for (const s of shortcutService.getState().shortcuts) {
      if (s.id === id) {
        return s;
      }
    }

    return null;
  },

  pushShortcut: (shortcut: Shortcut) => {
    store.dispatch(setShortcuts(shortcutService.getState().shortcuts.concat(shortcut)));
  },

  editShortcut: (shortcut: Shortcut) => {
    store.dispatch(patchShortcut(shortcut));
  },

  deleteShortcutById: async (shortcutId: ShortcutId) => {
    await api.deleteShortcutById(shortcutId);
    store.dispatch(deleteShortcut(shortcutId));
  },

  createShortcut: async (title: string, payload: string) => {
    const data = await api.createShortcut(title, payload);
    shortcutService.pushShortcut(convertResponseModelShortcut(data));
  },

  updateShortcut: async (shortcutId: ShortcutId, title: string, payload: string) => {
    const data = await api.updateShortcut(shortcutId, title, payload);
    store.dispatch(patchShortcut(convertResponseModelShortcut(data)));
  },

  pinShortcut: async (shortcutId: ShortcutId) => {
    await api.pinShortcut(shortcutId);
  },

  unpinShortcut: async (shortcutId: ShortcutId) => {
    await api.unpinShortcut(shortcutId);
  },
};

export default shortcutService;
