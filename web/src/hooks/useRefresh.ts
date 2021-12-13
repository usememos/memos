import { useCallback, useState } from "react";

function useRefresh() {
  const [, setBoolean] = useState<boolean>(false);

  const refresh = useCallback(() => {
    setBoolean((ps) => {
      return !ps;
    });
  }, []);

  return refresh;
}

export default useRefresh;
