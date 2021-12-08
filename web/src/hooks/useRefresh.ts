import { useCallback, useState } from "react";

function useRefresh() {
  const [_, setBoolean] = useState<Boolean>(false);

  const refresh = useCallback(() => {
    setBoolean((ps) => {
      return !ps;
    });
  }, []);

  return refresh;
}

export default useRefresh;
