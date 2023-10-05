import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { uniqBy } from "lodash-es";
import { Resource } from "@/types/proto/api/v2/resource_service";

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
        resources: uniqBy([...action.payload, ...state.resources], "id"),
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
  },
});

export const { setResources, upsertResources, patchResource } = resourceSlice.actions;

export default resourceSlice.reducer;
