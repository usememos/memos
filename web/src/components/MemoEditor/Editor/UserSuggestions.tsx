import { useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import { useSearchUsers } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { UserSuggestionsProps } from "../types";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

export default function UserSuggestions({ editorRef, editorActions }: UserSuggestionsProps) {
  const { position, selectedIndex, isVisible, searchQuery, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "@",
    items: ["placeholder"], // Placeholder for type inference
    filterItems: (items, _query) => items, // Filtering happens via API
    onAutocomplete: (username, word, index, actions) => {
      actions.removeText(index, word.length);
      actions.insertText(`@${username} `);
    },
  });

  const { data: users = [] } = useSearchUsers(searchQuery, {
    enabled: isVisible && searchQuery.length >= 2,
  });

  const filteredUsers = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const searchLower = searchQuery.toLowerCase();
    return users
      .filter((user) => user.username.toLowerCase().includes(searchLower) || user.displayName?.toLowerCase().includes(searchLower))
      .slice(0, 10); // Limit to 10 results
  }, [users, searchQuery]);

  // Override suggestions with filtered users
  const userSuggestions = useMemo(() => filteredUsers.map((u) => u.username), [filteredUsers]);

  if (!isVisible || !position || filteredUsers.length === 0) return null;

  return (
    <SuggestionsPopup
      position={position}
      suggestions={userSuggestions}
      selectedIndex={selectedIndex}
      onItemSelect={handleItemSelect}
      getItemKey={(username) => username}
      renderItem={(username, isSelected) => {
        const user = filteredUsers.find((u) => u.username === username);
        if (!user) return null;
        return (
          <div className={cn("flex items-center gap-2 w-full")}>
            <UserAvatar avatarUrl={user.avatarUrl} className="w-6 h-6" />
            <div className="flex flex-col min-w-0">
              <span className={cn("text-sm font-medium truncate", isSelected && "text-accent-foreground")}>
                {user.displayName || user.username}
              </span>
              {user.displayName && <span className="text-xs text-muted-foreground truncate">@{user.username}</span>}
            </div>
          </div>
        );
      }}
    />
  );
}
