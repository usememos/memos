import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  showHomeSidebar: boolean;
}

const layoutSlice = createSlice({
  name: "layout",
  initialState: {
    showHomeSidebar: false,
  } as State,
  reducers: {
    setHomeSidebarStatus: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        showHomeSidebar: action.payload,
      };
    },
  },
});

export const { setHomeSidebarStatus } = layoutSlice.actions;

export default layoutSlice.reducer;
