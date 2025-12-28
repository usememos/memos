import type { SlashCommandsProps } from "../types";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

const SlashCommands = ({ editorRef, editorActions, commands }: SlashCommandsProps) => {
  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "/",
    items: commands,
    filterItems: (items, query) => (!query ? items : items.filter((cmd) => cmd.name.toLowerCase().startsWith(query))),
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
        <span className="font-medium tracking-wide">
          <span className="text-muted-foreground">/</span>
          {cmd.name}
        </span>
      )}
    />
  );
};

export default SlashCommands;
