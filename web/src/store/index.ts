import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import globalReducer from "./modules/global";
import userReducer from "./modules/user";
import memoReducer from "./modules/memo";
import editorReducer from "./modules/editor";
import shortcutReducer from "./modules/shortcut";
import locationReducer from "./modules/location";
import resourceReducer from "./modules/resource";

const store = configureStore({
  reducer: {
    global: globalReducer,
    user: userReducer,
    memo: memoReducer,
    editor: editorReducer,
    shortcut: shortcutReducer,
    location: locationReducer,
    resource: resourceReducer,
  },
});

type AppState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
export const useAppDispatch: () => AppDispatch = useDispatch;

export default store;
