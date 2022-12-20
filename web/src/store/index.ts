import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import globalReducer from "./reducer/global";
import userReducer from "./reducer/user";
import memoReducer from "./reducer/memo";
import editorReducer from "./reducer/editor";
import shortcutReducer from "./reducer/shortcut";
import locationReducer from "./reducer/location";
import resourceReducer from "./reducer/resource";
import dialogReducer from "./reducer/dialog";

const store = configureStore({
  reducer: {
    global: globalReducer,
    user: userReducer,
    memo: memoReducer,
    editor: editorReducer,
    shortcut: shortcutReducer,
    location: locationReducer,
    resource: resourceReducer,
    dialog: dialogReducer,
  },
});

type AppState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
export const useAppDispatch: () => AppDispatch = useDispatch;

export default store;
