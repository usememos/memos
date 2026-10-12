import { Navigate, useLocation, useParams } from "react-router-dom";
import { ROUTES, withCollectionCreator } from "./routes";

/** Keep existing author links usable while Home owns creator scope. */
export const LegacyProfileRedirect = () => {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();
  return <Navigate to={{ pathname: ROUTES.HOME, search: withCollectionCreator(location.search, username), hash: location.hash }} replace />;
};
