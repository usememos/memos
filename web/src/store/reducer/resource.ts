import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { uniqBy } from "lodash-es";

interface State {
  resources: Resource[];
}

const resourceSlice = createSlice({
  name: "resource",
  initialState: {
    resources: [],
  } as State,
  reducers: {
    setResources: (state, action: PayloadAction<Resource[]>) => {
      return {
        ...state,
        resources: action.payload,
      };
    },
    upsertResources: (state, action: PayloadAction<Resource[]>) => {
      return {
        ...state,
        resources: uniqBy([...state.resources, ...action.payload], "id"),
      };
    },
    patchResource: (state, action: PayloadAction<Partial<Resource>>) => {
      return {
        ...state,
        resources: state.resources.map((resource) => {
          if (resource.id === action.payload.id) {
            return {
              ...resource,
              ...action.payload,
            };
          } else {
            return resource;
          }
        }),
      };
    },
    deleteResource: (state, action: PayloadAction<ResourceId>) => {
      return {
        ...state,
        resources: state.resources.filter((resource) => {
          return resource.id !== action.payload;
        }),
      };
    },
  },
});

export const { setResources, upsertResources, patchResource, deleteResource } = resourceSlice.actions;

export default resourceSlice.reducer;
