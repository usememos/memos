import { useEffect } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";

interface Props {
  children: React.ReactNode;
}

const AuthStatusProvider = (props: Props) => {
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      // If not logged in, redirect to explore page by default.
      navigateTo("/explore");
    }
  }, []);

  if (!currentUser) {
    return null;
  }

  return <>{props.children}</>;
};

export default AuthStatusProvider;
