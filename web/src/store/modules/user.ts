import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  user?: User;
}

const userSlice = createSlice({
  name: "user",
  initialState: {} as State,
  reducers: {
    setUser: (state, action: PayloadAction<User | undefined>) => {
      return {
        ...state,
        user: action.payload,
      };
    },
    patchUser: (state, action: PayloadAction<Partial<User>>) => {
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload,
        } as User,
      };
    },
  },
});

export const { setUser, patchUser } = userSlice.actions;

export default userSlice.reducer;
