import { useUserStore } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";

const useCurrentUser = () => {
  const userStore = useUserStore();
  return userStore.currentUser as User;
};

export default useCurrentUser;
