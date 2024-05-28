import { useEffect } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import useNavigateTo from "@/hooks/useNavigateTo";

const RootRedirector: React.FC = () => {
  const [lastVisited] = useLocalStorage<string>("lastVisited", "/home");
  const navigateTo = useNavigateTo();

  useEffect(() => {
    if (lastVisited === "/home" || lastVisited === "/timeline") {
      navigateTo(lastVisited);
    } else {
      navigateTo("/home");
    }
  }, []);

  return <></>;
};

export default RootRedirector;
