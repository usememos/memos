import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { ROUTES } from "@/router/routes";

const About = () => {
  const currentUser = useCurrentUser();
  const { setAboutOpen } = useAppSidebar();

  useEffect(() => {
    setAboutOpen(true);
  }, [setAboutOpen]);

  return <Navigate to={currentUser ? ROUTES.HOME : ROUTES.EXPLORE} replace />;
};

export default About;
