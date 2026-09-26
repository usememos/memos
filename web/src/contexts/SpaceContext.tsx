import type { ConnectError } from "@connectrpc/connect";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpace, useSpaces } from "@/hooks/useSpaceQueries";
import { buildCollectionScopeFilter, type CollectionScope, combineCELFilters } from "@/lib/cel-filter";
import { buildMemoCreatorFilter } from "@/lib/resource-names";
import { getDuplicateSpaceTitles } from "@/lib/space-display";
import {
  buildCollectionPath,
  getCollectionCreator,
  getCollectionHomePath,
  ROUTES,
  resolveCollectionRoute,
  withCollectionCreator,
} from "@/router/routes";
import type { Space } from "@/types/proto/api/v1/space_service_pb";

interface SpaceContextValue {
  spaces: Space[];
  spaceByName: ReadonlyMap<string, Space>;
  duplicateSpaceTitles: ReadonlySet<string>;
  selectedSpace?: Space;
  selectedSpaceName?: string;
  creatorUsername?: string;
  collectionScope: CollectionScope;
  memoFilter?: string;
  isLoadingSpaces: boolean;
  isSpacesError: boolean;
  isSpaceReady: boolean;
  spaceError: ConnectError | null;
  retrySpace: () => void;
  /** Opens the Space Home after creation or from an invitation. */
  selectSpace: (space: Space) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);
const NO_SPACES: Space[] = [];

export function SpaceProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const userName = user?.name;
  const location = useLocation();
  const navigate = useNavigate();
  const route = resolveCollectionRoute(location.pathname);
  const selectedSpaceName = route.spaceName;
  const creatorUsername = route.isCollection
    ? route.pathname === ROUTES.EXPLORE
      ? undefined
      : (getCollectionCreator(location.search) ?? (route.pathname === ROUTES.HOME ? user?.username : undefined))
    : undefined;
  const spacesQuery = useSpaces(userName);
  const spaceQuery = useSpace(userName, selectedSpaceName);
  const spaces = spacesQuery.data ?? NO_SPACES;
  const selectedSpace = spaceQuery.data;
  const spaceByName = useMemo(() => {
    const result = new Map(spaces.map((space) => [space.name, space]));
    if (selectedSpace) result.set(selectedSpace.name, selectedSpace);
    return result;
  }, [spaces, selectedSpace]);
  const duplicateSpaceTitles = useMemo(() => getDuplicateSpaceTitles([...spaceByName.values()]), [spaceByName]);
  const collectionScope = useMemo<CollectionScope>(
    () => (selectedSpaceName ? { kind: "space", name: selectedSpaceName } : { kind: "all" }),
    [selectedSpaceName],
  );
  const selectSpace = useCallback(
    (space: Space) => {
      const homePath = getCollectionHomePath(location);
      navigate(`${buildCollectionPath(homePath, space.name)}${withCollectionCreator("", getCollectionCreator(location.search))}`);
    },
    [location, navigate],
  );
  const retrySpace = useCallback(() => {
    void spaceQuery.refetch();
  }, [spaceQuery.refetch]);
  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      spaceByName,
      duplicateSpaceTitles,
      selectedSpace,
      selectedSpaceName,
      creatorUsername,
      collectionScope,
      memoFilter: combineCELFilters(
        buildCollectionScopeFilter(collectionScope),
        creatorUsername && buildMemoCreatorFilter(creatorUsername),
      ),
      isLoadingSpaces: spacesQuery.isPending,
      isSpacesError: spacesQuery.isError,
      isSpaceReady: !selectedSpaceName || (Boolean(userName) && spaceQuery.isSuccess),
      spaceError: spaceQuery.error,
      retrySpace,
      selectSpace,
    }),
    [
      spaces,
      spaceByName,
      duplicateSpaceTitles,
      selectedSpace,
      selectedSpaceName,
      creatorUsername,
      collectionScope,
      spacesQuery.isPending,
      spacesQuery.isError,
      userName,
      spaceQuery.isSuccess,
      spaceQuery.error,
      retrySpace,
      selectSpace,
    ],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpaceContext() {
  const context = useContext(SpaceContext);
  if (!context) throw new Error("useSpaceContext must be used within SpaceProvider");
  return context;
}
