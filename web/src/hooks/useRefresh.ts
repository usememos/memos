import { useCallback, useState } from "react";

export default function useRefresh() {
  const [, setBoolean] = useState<boolean>(false);

  const refresh = useCallback(() => {
    setBoolean((ps) => {
      return !ps;
    });
  }, []);

  return refresh;
}
