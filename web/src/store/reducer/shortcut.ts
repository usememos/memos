import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  shortcuts: Shortcut[];
}

const shortcutSlice = createSlice({
  name: "memo",
  initialState: {
    shortcuts: [],
  } as State,
  reducers: {
    setShortcuts: (state, action: PayloadAction<Shortcut[]>) => {
      return {
        ...state,
        shortcuts: action.payload,
      };
    },
    createShortcut: (state, action: PayloadAction<Shortcut>) => {
      return {
        ...state,
        shortcuts: state.shortcuts.concat(action.payload).sort((a, b) => b.createdTs - a.createdTs),
      };
    },
    patchShortcut: (state, action: PayloadAction<Partial<Shortcut>>) => {
      return {
        ...state,
        shortcuts: state.shortcuts.map((s) => {
          if (s.id === action.payload.id) {
            return {
              ...s,
              ...action.payload,
            };
          } else {
            return s;
          }
        }),
      };
    },
    deleteShortcut: (state, action: PayloadAction<ShortcutId>) => {
      return {
        ...state,
        shortcuts: [...state.shortcuts].filter((shortcut) => shortcut.id !== action.payload),
      };
    },
  },
});

export const { setShortcuts, createShortcut, patchShortcut, deleteShortcut } = shortcutSlice.actions;

export default shortcutSlice.reducer;
