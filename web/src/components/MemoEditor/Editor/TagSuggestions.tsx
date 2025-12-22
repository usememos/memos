import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import OverflowTip from "@/components/kit/OverflowTip";
import { userStore } from "@/store";
import type { EditorRefActions } from ".";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

interface TagSuggestionsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
}

const TagSuggestions = observer(({ editorRef, editorActions }: TagSuggestionsProps) => {
  const sortedTags = useMemo(() => {
    return Object.entries(userStore.state.tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [userStore.state.tagCount]);

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
});

export default TagSuggestions;
