import { extractUsernameFromName, useUserStore } from "@/store/v1";

const useCurrentUser = () => {
  const userStore = useUserStore();
  return userStore.getUserByUsername(extractUsernameFromName(userStore.currentUser) || "");
};

export default useCurrentUser;
