import utils from "../helpers/utils";

export interface State {
  shortcuts: Shortcut[];
}

interface SetShortcutsAction {
  type: "SET_SHORTCUTS";
  payload: {
    shortcuts: Shortcut[];
  };
}

interface InsertShortcutAction {
  type: "INSERT_SHORTCUT";
  payload: {
    shortcut: Shortcut;
  };
}

interface DeleteShortcutByIdAction {
  type: "DELETE_SHORTCUT_BY_ID";
  payload: {
    id: string;
  };
}

interface UpdateShortcutAction {
  type: "UPDATE_SHORTCUT";
  payload: Shortcut;
}

export type Actions = SetShortcutsAction | InsertShortcutAction | DeleteShortcutByIdAction | UpdateShortcutAction;

export function reducer(state: State, action: Actions): State {
  switch (action.type) {
    case "SET_SHORTCUTS": {
      const shortcuts = utils.dedupeObjectWithId(
        action.payload.shortcuts
          .sort((a, b) => utils.getTimeStampByDate(b.createdTs) - utils.getTimeStampByDate(a.createdTs))
          .sort((a, b) => utils.getTimeStampByDate(b.updatedTs) - utils.getTimeStampByDate(a.updatedTs))
      );

      return {
        ...state,
        shortcuts,
      };
    }
    case "INSERT_SHORTCUT": {
      const shortcuts = utils.dedupeObjectWithId(
        [action.payload.shortcut, ...state.shortcuts].sort(
          (a, b) => utils.getTimeStampByDate(b.createdTs) - utils.getTimeStampByDate(a.createdTs)
        )
      );

      return {
        ...state,
        shortcuts,
      };
    }
    case "DELETE_SHORTCUT_BY_ID": {
      return {
        ...state,
        shortcuts: [...state.shortcuts].filter((shortcut) => shortcut.id !== action.payload.id),
      };
    }
    case "UPDATE_SHORTCUT": {
      const shortcuts = state.shortcuts.map((m) => {
        if (m.id === action.payload.id) {
          return {
            ...m,
            ...action.payload,
          };
        } else {
          return m;
        }
      });

      return {
        ...state,
        shortcuts,
      };
    }
    default: {
      return state;
    }
  }
}

export const defaultState: State = {
  shortcuts: [],
};
