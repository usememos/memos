import { useState } from "react";

const useLoading = (initialState = true) => {
  const [state, setState] = useState({ isLoading: initialState, isFailed: false, isSucceed: false });

  return {
    ...state,
    setLoading: () => {
      setState({
        ...state,
        isLoading: true,
        isFailed: false,
        isSucceed: false,
      });
    },
    setFinish: () => {
      setState({
        ...state,
        isLoading: false,
        isFailed: false,
        isSucceed: true,
      });
    },
    setError: () => {
      setState({
        ...state,
        isLoading: false,
        isFailed: true,
        isSucceed: false,
      });
    },
  };
};

export default useLoading;
