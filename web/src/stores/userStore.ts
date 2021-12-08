export interface State {
  user: Model.User | null;
}

interface SignInAction {
  type: "SIGN_IN";
  payload: State;
}

interface SignOutAction {
  type: "SIGN_OUT";
  payload: null;
}

export type Actions = SignInAction | SignOutAction;

export function reducer(state: State, action: Actions): State {
  switch (action.type) {
    case "SIGN_IN": {
      return {
        user: action.payload.user,
      };
    }
    case "SIGN_OUT": {
      return {
        user: null,
      };
    }
    default: {
      return state;
    }
  }
}

export const defaultState: State = { user: null };
