import { createContext } from "react";
import appStore from "./appStore";

const appContext = createContext(appStore.getState());

export default appContext;
