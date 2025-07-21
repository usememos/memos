import { userStore } from "@/store";

const useCurrentUser = () => {
  return userStore.state.userMapByName[userStore.state.currentUser || ""];
};

export default useCurrentUser;
