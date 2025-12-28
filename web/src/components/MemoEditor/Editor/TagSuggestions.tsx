import { useMemo } from "react";
import { matchPath } from "react-router-dom";
import OverflowTip from "@/components/kit/OverflowTip";
import { useTagCounts } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import type { TagSuggestionsProps } from "../types";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

export default function TagSuggestions({ editorRef, editorActions }: TagSuggestionsProps) {
  // On explore page, show all users' tags; otherwise show current user's tags
  const isExplorePage = Boolean(matchPath(Routes.EXPLORE, window.location.pathname));
  const { data: tagCount = {} } = useTagCounts(!isExplorePage);

  const sortedTags = useMemo(() => {
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [tagCount]);

  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "#",
    items: sortedTags,
    filterItems: (items, query) => (!query ? items : items.filter((tag) => tag.toLowerCase().includes(query))),
    onAutocomplete: (tag, word, index, actions) => {
      actions.removeText(index, word.length);
      actions.insertText(`#${tag} `);
    },
  });

  if (!isVisible || !position) return null;

  return (
    <SuggestionsPopup
      position={position}
      suggestions={suggestions}
      selectedIndex={selectedIndex}
      onItemSelect={handleItemSelect}
      getItemKey={(tag) => tag}
      renderItem={(tag) => (
        <OverflowTip>
          <span className="text-muted-foreground mr-1">#</span>
          {tag}
        </OverflowTip>
      )}
    />
  );
}
