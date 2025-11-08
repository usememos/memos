import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import OverflowTip from "@/components/kit/OverflowTip";
import { userStore } from "@/store";
import { EditorRefActions } from ".";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

interface TagSuggestionsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
}

/**
 * Tag suggestions popup that appears when typing "#" in the editor.
 * Shows previously used tags sorted by frequency.
 *
 * Usage:
 * - Type "#" to trigger
 * - Continue typing to filter tags
 * - Use Arrow keys to navigate, Enter/Tab to select
 * - Tags are sorted by usage count (most used first)
 */
const TagSuggestions = observer(({ editorRef, editorActions }: TagSuggestionsProps) => {
  // Sort tags by usage count (descending), then alphabetically for ties
  const sortedTags = useMemo(
    () =>
      Object.entries(userStore.state.tagCount)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag),
    [userStore.state.tagCount],
  );

  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "#",
    items: sortedTags,
    filterItems: (items, searchQuery) => {
      if (!searchQuery) return items;
      // Filter tags by substring match for flexible searching
      return items.filter((tag) => tag.toLowerCase().includes(searchQuery));
    },
    onAutocomplete: (tag, word, index, actions) => {
      // Replace the trigger word with the complete tag and add a trailing space
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
      renderItem={(tag) => <OverflowTip>#{tag}</OverflowTip>}
    />
  );
});

export default TagSuggestions;
