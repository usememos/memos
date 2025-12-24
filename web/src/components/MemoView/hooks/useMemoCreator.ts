import { useEffect, useState } from "react";
import { userStore } from "@/store";

export const useMemoCreator = (creatorName: string) => {
  const [creator, setCreator] = useState(userStore.getUserByName(creatorName));

  useEffect(() => {
    userStore.getOrFetchUser(creatorName).then(setCreator);
  }, [creatorName]);

  return creator;
};
