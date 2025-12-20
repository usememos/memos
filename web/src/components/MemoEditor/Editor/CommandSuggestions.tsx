import { observer } from "mobx-react-lite";
import OverflowTip from "@/components/kit/OverflowTip";
import type { EditorRefActions } from ".";
import type { Command } from "./commands";
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
      if (!searchQuery) return items;
      // Filter commands by prefix match for intuitive searching
      return items.filter((cmd) => cmd.name.toLowerCase().startsWith(searchQuery));
    },
    onAutocomplete: (cmd, word, index, actions) => {
      // Replace the trigger word with the command output
      actions.removeText(index, word.length);
      const initialPosition = actions.getCursorPosition();
      actions.insertText(cmd.run());

      const offset = cmd.cursorRange?.[0];
      if (typeof offset === "undefined") return;

      const cursorPosition = initialPosition + offset;
      const length = cmd.cursorRange?.[1] || 0;
      actions.setCursorPosition(cursorPosition, cursorPosition + length);
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
