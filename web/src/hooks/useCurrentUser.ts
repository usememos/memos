import { useAuth } from "@/contexts/AuthContext";

const useCurrentUser = () => {
  const { currentUser } = useAuth();
  return currentUser;
};

export default useCurrentUser;
