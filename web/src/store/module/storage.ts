import store, { useAppSelector } from "..";
import * as api from "../../helpers/api";
import { setStorages, createStorage, patchStorage, deleteStorage } from "../reducer/storage";

export const useStorageStore = () => {
  const state = useAppSelector((state) => state.storage);
  return {
    state,
    getState: () => {
      return store.getState().storage;
    },
    fetchStorages: async () => {
      const { data } = (await api.getStorageList()).data;
      store.dispatch(setStorages(data));
    },
    createStorage: async (storageCreate: StorageCreate) => {
      const { data: storage } = (await api.createStorage(storageCreate)).data;
      store.dispatch(createStorage(storage));
      return storage;
    },
    patchStorage: async (storagePatch: StoragePatch) => {
      const { data: storage } = (await api.patchStorage(storagePatch)).data;
      store.dispatch(patchStorage(storage));
      return storage;
    },
    deleteStorageById: async (storageId: StorageId) => {
      await api.deleteStorage(storageId);
      store.dispatch(deleteStorage(storageId));
    },
  };
};
