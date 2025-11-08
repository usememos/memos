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

const TagSuggestions = observer(({ editorRef, editorActions }: TagSuggestionsProps) => {
  // Sort tags by usage count (descending), then alphabetically
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
      // Show all tags when no search query
      if (!searchQuery) return items;
      // Filter tags that contain the search query
      return items.filter((tag) => tag.toLowerCase().includes(searchQuery));
    },
    onAutocomplete: (tag, word, index, actions) => {
      actions.removeText(index, word.length);
      actions.insertText(`#${tag}`);
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
