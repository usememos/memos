import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  // host is the user who hist the system
  host?: User;
  // user is the user who is currently logged in
  user?: User;
}

const userSlice = createSlice({
  name: "user",
  initialState: {} as State,
  reducers: {
    setHost: (state, action: PayloadAction<User | undefined>) => {
      return {
        ...state,
        host: action.payload,
      };
    },
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

export const { setHost, setUser, patchUser } = userSlice.actions;

export default userSlice.reducer;
