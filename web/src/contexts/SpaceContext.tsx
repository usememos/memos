import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { buildSpaceFilter } from "@/lib/cel-filter";
import { ROUTES } from "@/router/routes";
import type { Space } from "@/types/proto/api/v1/space_service_pb";

const SELECTED_SPACE_STORAGE_PREFIX = "memos-selected-space:";

export const getSelectedSpaceStorageKey = (userName: string) => `${SELECTED_SPACE_STORAGE_PREFIX}${userName}`;

const readSelectedSpaceName = (userName: string): string | undefined => {
  try {
    return sessionStorage.getItem(getSelectedSpaceStorageKey(userName)) || undefined;
  } catch {
    return undefined;
  }
};

const writeSelectedSpaceName = (userName: string, spaceName: string | undefined) => {
  try {
    const key = getSelectedSpaceStorageKey(userName);
    if (spaceName) {
      sessionStorage.setItem(key, spaceName);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage can be unavailable in restricted browser contexts.
  }
};

interface SpaceContextValue {
  spaces: Space[];
  selectedSpace?: Space;
  selectedSpaceName?: string;
  memoFilter?: string;
  isLoadingSpaces: boolean;
  isSpacesError: boolean;
  selectSpace: (space: Space) => void;
  selectMemos: () => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

// Stable identity for the pre-load and error states, so the memoized context value
// below does not rebuild — and re-render every consumer — on each provider render.
const NO_SPACES: Space[] = [];

function UserSpaceSession({ userName, children }: { userName: string; children: ReactNode }) {
  // Switching context lands on that context's feed, so the switcher doubles as the
  // brand slot's way home. Held in a ref because `navigate` changes identity on every
  // route change, which would otherwise rebuild the context value — and re-render the
  // global composer and the editor tree it hosts — on each navigation.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [selectedSpaceName, setSelectedSpaceName] = useState(() => readSelectedSpaceName(userName));
  const [optimisticSpace, setOptimisticSpace] = useState<Space>();
  const spacesQuery = useSpaces(userName);
  const spaces = spacesQuery.data ?? NO_SPACES;
  const listedSelectedSpace = spaces.find((space) => space.name === selectedSpaceName);
  const selectedSpace = listedSelectedSpace ?? (optimisticSpace?.name === selectedSpaceName ? optimisticSpace : undefined);

  useEffect(() => {
    if (listedSelectedSpace && optimisticSpace?.name === listedSelectedSpace.name) {
      setOptimisticSpace(undefined);
    }
  }, [listedSelectedSpace, optimisticSpace]);

  useEffect(() => {
    if (!selectedSpaceName || !spacesQuery.isSuccess || selectedSpace) {
      return;
    }

    writeSelectedSpaceName(userName, undefined);
    setSelectedSpaceName(undefined);
  }, [selectedSpace, selectedSpaceName, spacesQuery.isSuccess, userName]);

  const selectSpace = useCallback(
    (space: Space) => {
      writeSelectedSpaceName(userName, space.name);
      setOptimisticSpace(space);
      setSelectedSpaceName(space.name);
      navigateRef.current(ROUTES.HOME);
    },
    [userName],
  );

  const selectMemos = useCallback(() => {
    writeSelectedSpaceName(userName, undefined);
    setOptimisticSpace(undefined);
    setSelectedSpaceName(undefined);
    navigateRef.current(ROUTES.HOME);
  }, [userName]);

  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      selectedSpace,
      selectedSpaceName,
      memoFilter: buildSpaceFilter(selectedSpaceName),
      isLoadingSpaces: spacesQuery.isPending,
      isSpacesError: spacesQuery.isError,
      selectSpace,
      selectMemos,
    }),
    [selectMemos, selectSpace, selectedSpace, selectedSpaceName, spaces, spacesQuery.isError, spacesQuery.isPending],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

const anonymousValue: SpaceContextValue = {
  spaces: [],
  isLoadingSpaces: false,
  isSpacesError: false,
  selectSpace: () => undefined,
  selectMemos: () => undefined,
};

export function SpaceProvider({ children }: { children: ReactNode }) {
  const currentUserName = useCurrentUser()?.name;

  if (!currentUserName) {
    return <SpaceContext.Provider value={anonymousValue}>{children}</SpaceContext.Provider>;
  }

  return (
    <UserSpaceSession key={currentUserName} userName={currentUserName}>
      {children}
    </UserSpaceSession>
  );
}

export function useSpaceContext() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpaceContext must be used within SpaceProvider");
  }
  return context;
}
