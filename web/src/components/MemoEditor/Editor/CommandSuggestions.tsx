import { observer } from "mobx-react-lite";
import OverflowTip from "@/components/kit/OverflowTip";
import { Command } from "../types/command";
import { EditorRefActions } from ".";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

interface CommandSuggestionsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  commands: Command[];
}

/**
 * Command suggestions popup that appears when typing "/" in the editor.
 * Shows available editor commands like formatting options, insertions, etc.
 *
 * Usage:
 * - Type "/" to trigger
 * - Continue typing to filter commands
 * - Use Arrow keys to navigate, Enter/Tab to select
 */
const CommandSuggestions = observer(({ editorRef, editorActions, commands }: CommandSuggestionsProps) => {
  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "/",
    items: commands,
    filterItems: (items, searchQuery) => {
      if (!searchQuery) return items;
      // Filter commands by prefix match for intuitive searching
      return items.filter((cmd) => cmd.name.toLowerCase().startsWith(searchQuery));
    },
    onAutocomplete: (cmd, word, index, actions) => {
      // Replace the trigger word with the command output
      actions.removeText(index, word.length);
      actions.insertText(cmd.run());
      // Position cursor if command specifies an offset
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
      renderItem={(cmd) => <OverflowTip>/{cmd.name}</OverflowTip>}
    />
  );
});

export default CommandSuggestions;
