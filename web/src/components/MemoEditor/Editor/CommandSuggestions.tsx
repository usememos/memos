import { observer } from "mobx-react-lite";
import OverflowTip from "@/components/kit/OverflowTip";
import { EditorRefActions } from ".";
import { Command } from "../types/command";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

interface CommandSuggestionsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  commands: Command[];
}

const CommandSuggestions = observer(({ editorRef, editorActions, commands }: CommandSuggestionsProps) => {
  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "/",
    items: commands,
    filterItems: (items, searchQuery) => {
      // Show all commands when no search query
      if (!searchQuery) return items;
      // Filter commands that start with the search query
      return items.filter((cmd) => cmd.name.toLowerCase().startsWith(searchQuery));
    },
    onAutocomplete: (cmd, word, index, actions) => {
      actions.removeText(index, word.length);
      actions.insertText(cmd.run());
      if (cmd.cursorOffset) {
        actions.setCursorPosition(actions.getCursorPosition() + cmd.cursorOffset);
      }
    },
  });

  if (!isVisible || !position) return null;

  return (
    <SuggestionsPopup
      position={position}
      suggestions={suggestions}
      selectedIndex={selectedIndex}
      onItemSelect={handleItemSelect}
      getItemKey={(cmd) => cmd.name}
      renderItem={(cmd) => (
        <>
          <OverflowTip>/{cmd.name}</OverflowTip>
          {cmd.description && <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>}
        </>
      )}
    />
  );
});

export default CommandSuggestions;
