import { userStore } from "@/store/v2";

const useCurrentUser = () => {
  return userStore.state.userMapByName[userStore.state.currentUser || ""];
};

export default useCurrentUser;
