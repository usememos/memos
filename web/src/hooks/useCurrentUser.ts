import { useUserStore } from "@/store/v1";

const useCurrentUser = () => {
  const userStore = useUserStore();
  return userStore.getUserByName(userStore.currentUser || "");
};

export default useCurrentUser;
