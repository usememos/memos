import { useEffect } from "react";
import { useUserStore } from "@/store/module";
import { useUserV1Store } from "@/store/v1";

const useCurrentUser = () => {
  const userStore = useUserStore();
  const userV1Store = useUserV1Store();
  const currentUsername = userStore.state.user?.username;

  useEffect(() => {
    if (currentUsername) {
      userV1Store.getOrFetchUserByUsername(currentUsername);
    }
  }, [currentUsername]);

  return userV1Store.getUserByUsername(currentUsername || "");
};

export default useCurrentUser;
