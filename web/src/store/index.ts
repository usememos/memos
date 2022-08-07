import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import userReducer from "./modules/user";
import memoReducer from "./modules/memo";
import editorReducer from "./modules/editor";
import shortcutReducer from "./modules/shortcut";
import locationReducer from "./modules/location";

const store = configureStore({
  reducer: {
    user: userReducer,
    memo: memoReducer,
    editor: editorReducer,
    shortcut: shortcutReducer,
    location: locationReducer,
  },
});

type AppState = ReturnType<typeof store.getState>;

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;

export default store;
