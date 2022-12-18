import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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

export const { setResources, patchResource, deleteResource } = resourceSlice.actions;

export default resourceSlice.reducer;
