import * as api from "../../helpers/api";
import store, { useAppSelector } from "../";
import { setStorageState } from "../reducer/storage";

export const initialStorageState = async () => {
  const defaultStorageState = {
    smmsConfig: {
      token: "",
    } as SMMSConfig,
  };

  try {
    const { data } = (await api.getStorageStatus()).data;
    if (data) {
      defaultStorageState.smmsConfig = data.smmsConfig;
    }
  } catch (error) {
    // do nth
  }
  store.dispatch(setStorageState(defaultStorageState));
};

export const useStorageStore = () => {
  const state = useAppSelector((state) => state.storage);

  return {
    state,
    getState: () => {
      return store.getState().storage;
    },
    fetchStorageStatus: async () => {
      const { data: storageStatus } = (await api.getStorageStatus()).data;
      store.dispatch(setStorageState(storageStatus));
      return storageStatus;
    },
  };
};
