import { useUserStore } from "@/store/v1";

const useCurrentUser = () => {
  const userStore = useUserStore();
  return userStore.getUserByUsername(userStore.currentUser?.username || "");
};

export default useCurrentUser;
