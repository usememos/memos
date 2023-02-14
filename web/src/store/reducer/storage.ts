import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  storages: Storage[];
}

const storageSlice = createSlice({
  name: "storage",
  initialState: {
    storages: [],
  } as State,
  reducers: {
    setStorages: (state, action: PayloadAction<Storage[]>) => {
      return {
        ...state,
        storages: action.payload,
      };
    },
    createStorage: (state, action: PayloadAction<Storage>) => {
      return {
        ...state,
        storages: [action.payload].concat(state.storages),
      };
    },
    patchStorage: (state, action: PayloadAction<Partial<Storage>>) => {
      return {
        ...state,
        storages: state.storages.map((storage) => {
          if (storage.id === action.payload.id) {
            return {
              ...storage,
              ...action.payload,
            };
          } else {
            return storage;
          }
        }),
      };
    },
    deleteStorage: (state, action: PayloadAction<StorageId>) => {
      return {
        ...state,
        storages: state.storages.filter((storage) => {
          return storage.id !== action.payload;
        }),
      };
    },
  },
});

export const { setStorages, createStorage, patchStorage, deleteStorage } = storageSlice.actions;

export default storageSlice.reducer;
