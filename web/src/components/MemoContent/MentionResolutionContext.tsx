import { useQueries } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { userDetailQueryOptions, useUsersByUsernames } from "@/hooks/useUserQueries";
import { extractUsernameFromName } from "@/lib/resource-names";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { extractMentionUsernames } from "@/utils/remark-plugins/remark-mention";

interface UserResolutionContextValue {
  mentionUsernamesByContent: ReadonlyMap<string, string[]>;
  requestedUserNames: ReadonlySet<string>;
  resolvedMentionUsernames: ReadonlySet<string>;
  usersByName: ReadonlyMap<string, User | undefined>;
}

const UserResolutionContext = createContext<UserResolutionContextValue | null>(null);
const EMPTY_USER_NAMES: string[] = [];

interface MentionResolutionProviderProps {
  contents: string[];
  userNames?: string[];
  children: ReactNode;
}

export const MentionResolutionProvider = ({ contents, userNames = EMPTY_USER_NAMES, children }: MentionResolutionProviderProps) => {
  const mentionUsernamesByContent = useMemo(
    () => new Map(contents.map((content) => [content, extractMentionUsernames(content)] as const)),
    [contents],
  );
  const mentionUsernames = useMemo(
    () => Array.from(new Set(Array.from(mentionUsernamesByContent.values()).flat())),
    [mentionUsernamesByContent],
  );
  const requestedUserNames = useMemo(() => new Set(userNames.filter(Boolean)), [userNames]);
  const requestedUsernames = useMemo(
    () => Array.from(new Set([...mentionUsernames, ...Array.from(requestedUserNames, extractUsernameFromName)])),
    [mentionUsernames, requestedUserNames],
  );
  const { data: usersByUsername } = useUsersByUsernames(requestedUsernames);
  const value = useMemo<UserResolutionContextValue>(() => {
    const resolvedMentionUsernames = new Set<string>();
    const usersByName = new Map<string, User | undefined>();

    for (const [username, user] of usersByUsername ?? []) {
      if (user) {
        usersByName.set(user.name, user);
        if (mentionUsernames.includes(username)) {
          resolvedMentionUsernames.add(username);
        }
      }
    }

    return { mentionUsernamesByContent, requestedUserNames, resolvedMentionUsernames, usersByName };
  }, [mentionUsernames, mentionUsernamesByContent, requestedUserNames, usersByUsername]);

  return <UserResolutionContext.Provider value={value}>{children}</UserResolutionContext.Provider>;
};

export function useResolvedMentionUsernames(content: string) {
  const sharedResolution = useContext(UserResolutionContext);
  const shouldUseSharedResolution = sharedResolution !== null;
  const usernames = useMemo(
    () => sharedResolution?.mentionUsernamesByContent.get(content) ?? extractMentionUsernames(content),
    [content, sharedResolution],
  );
  const { data: mentionUsers } = useUsersByUsernames(usernames, { enabled: !shouldUseSharedResolution });

  return useMemo(() => {
    if (sharedResolution) {
      return new Set(usernames.filter((username) => sharedResolution.resolvedMentionUsernames.has(username)));
    }
    if (!mentionUsers) {
      return new Set<string>();
    }

    return new Set(Array.from(mentionUsers.entries()).flatMap(([username, user]) => (user ? [username] : [])));
  }, [mentionUsers, sharedResolution, usernames]);
}

export function useResolvedUser(name: string, options?: { enabled?: boolean }) {
  const sharedResolution = useContext(UserResolutionContext);
  const enabled = options?.enabled ?? true;
  const useSharedResolution = enabled && Boolean(sharedResolution?.requestedUserNames.has(name));
  const fallbackQueryOptions: ReturnType<typeof userDetailQueryOptions>[] =
    enabled && !useSharedResolution ? [userDetailQueryOptions(name)] : [];
  const fallbackQueries = useQueries({ queries: fallbackQueryOptions });

  return useSharedResolution ? sharedResolution?.usersByName.get(name) : fallbackQueries[0]?.data;
}

export function useResolvedUsersByNames(names: string[]) {
  const sharedResolution = useContext(UserResolutionContext);
  const useSharedResolution = Boolean(sharedResolution && names.every((name) => sharedResolution.requestedUserNames.has(name)));
  const uniqueNames = useMemo(() => Array.from(new Set(names)), [names]);
  const fallbackQueries = useQueries({
    queries: useSharedResolution ? [] : uniqueNames.map((name) => userDetailQueryOptions(name)),
  });

  return useMemo(() => {
    if (useSharedResolution && sharedResolution) {
      return new Map(names.map((name) => [name, sharedResolution.usersByName.get(name)] as const));
    }

    return new Map(uniqueNames.map((name, index) => [name, fallbackQueries[index]?.data] as const));
  }, [fallbackQueries, names, sharedResolution, uniqueNames, useSharedResolution]);
}
