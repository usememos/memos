import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { ROUTES } from "@/router/routes";

const About = () => {
  const currentUser = useCurrentUser();
  const { setAboutOpen } = useAppSidebar();
  const { isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized) setAboutOpen(true);
  }, [isInitialized, setAboutOpen]);

  if (!isInitialized) return null;

  return <Navigate to={currentUser ? ROUTES.HOME : ROUTES.EXPLORE} replace />;
};

export default About;
