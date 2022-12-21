import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  tags: string[];
}

const tagSlice = createSlice({
  name: "tag",
  initialState: {
    tags: [],
  } as State,
  reducers: {
    setTags: (state, action: PayloadAction<string[]>) => {
      return {
        ...state,
        tags: action.payload,
      };
    },
    upsertTag: (state, action: PayloadAction<string>) => {
      if (state.tags.includes(action.payload)) {
        return state;
      }

      return {
        ...state,
        tags: state.tags.concat(action.payload),
      };
    },
    deleteTag: (state, action: PayloadAction<string>) => {
      return {
        ...state,
        tags: state.tags.filter((tag) => {
          return tag !== action.payload;
        }),
      };
    },
  },
});

export const { setTags, upsertTag, deleteTag } = tagSlice.actions;

export default tagSlice.reducer;
