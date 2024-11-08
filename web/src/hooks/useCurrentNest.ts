import { useCommonContext } from "@/layouts/CommonContextProvider";

const useCurrentNest = () => {
  const commonContext = useCommonContext();
  return commonContext.nest;
};

export default useCurrentNest;
