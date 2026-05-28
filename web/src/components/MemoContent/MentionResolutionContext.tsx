import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useUsersByUsernames } from "@/hooks/useUserQueries";
import { extractMentionUsernames } from "@/utils/remark-plugins/remark-mention";

const MentionResolutionContext = createContext<Set<string> | null>(null);

interface MentionResolutionProviderProps {
  contents: string[];
  children: ReactNode;
}

export const MentionResolutionProvider = ({ contents, children }: MentionResolutionProviderProps) => {
  const mentionUsernames = useMemo(() => Array.from(new Set(contents.flatMap((content) => extractMentionUsernames(content)))), [contents]);
  const { data: mentionUsers } = useUsersByUsernames(mentionUsernames);
  const resolvedMentionUsernames = useMemo(() => {
    if (!mentionUsers) {
      return new Set<string>();
    }

    return new Set(Array.from(mentionUsers.entries()).flatMap(([username, user]) => (user ? [username] : [])));
  }, [mentionUsers]);

  return <MentionResolutionContext.Provider value={resolvedMentionUsernames}>{children}</MentionResolutionContext.Provider>;
};

export function useResolvedMentionUsernames(usernames: string[]) {
  const sharedResolvedMentionUsernames = useContext(MentionResolutionContext);
  const shouldUseSharedResolution = sharedResolvedMentionUsernames !== null;
  const { data: mentionUsers } = useUsersByUsernames(usernames, { enabled: !shouldUseSharedResolution });

  return useMemo(() => {
    if (sharedResolvedMentionUsernames) {
      return sharedResolvedMentionUsernames;
    }
    if (!mentionUsers) {
      return new Set<string>();
    }

    return new Set(Array.from(mentionUsers.entries()).flatMap(([username, user]) => (user ? [username] : [])));
  }, [sharedResolvedMentionUsernames, mentionUsers]);
}
