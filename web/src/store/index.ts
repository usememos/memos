import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import dialogReducer from "./reducer/dialog";
import filterReducer from "./reducer/filter";
import globalReducer from "./reducer/global";
import memoReducer from "./reducer/memo";
import resourceReducer from "./reducer/resource";
import tagReducer from "./reducer/tag";

const store = configureStore({
  reducer: {
    global: globalReducer,
    memo: memoReducer,
    tag: tagReducer,
    filter: filterReducer,
    resource: resourceReducer,
    dialog: dialogReducer,
  },
});

type AppState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
export const useAppDispatch: () => AppDispatch = useDispatch;

export default store;
