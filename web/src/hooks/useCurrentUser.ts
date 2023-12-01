import { useUserV1Store } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";

const useCurrentUser = () => {
  const userV1Store = useUserV1Store();
  return userV1Store.currentUser as User;
};

export default useCurrentUser;
