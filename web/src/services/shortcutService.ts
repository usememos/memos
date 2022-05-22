import api from "../helpers/api";
import store from "../store/";
import { createShortcut, deleteShortcut, patchShortcut, setShortcuts } from "../store/modules/shortcut";

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
    const rawData = await api.getMyShortcuts();
    const shortcuts = rawData.map((s) => convertResponseModelShortcut(s));
    store.dispatch(setShortcuts(shortcuts));
  },

  getShortcutById: (id: ShortcutId) => {
    for (const s of shortcutService.getState().shortcuts) {
      if (s.id === id) {
        return s;
      }
    }

    return null;
  },

  createShortcut: async (shortcutCreate: ShortcutCreate) => {
    const data = await api.createShortcut(shortcutCreate);
    const shortcut = convertResponseModelShortcut(data);
    store.dispatch(createShortcut(shortcut));
  },

  patchShortcut: async (shortcutPatch: ShortcutPatch) => {
    const data = await api.patchShortcut(shortcutPatch);
    const shortcut = convertResponseModelShortcut(data);
    store.dispatch(patchShortcut(shortcut));
  },

  deleteShortcutById: async (shortcutId: ShortcutId) => {
    await api.deleteShortcutById(shortcutId);
    store.dispatch(deleteShortcut(shortcutId));
  },
};

export default shortcutService;
