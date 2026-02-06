import type { SlashCommandsProps } from "../types";
import type { EditorRefActions } from ".";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

const SlashCommands = ({ editorRef, editorActions, commands }: SlashCommandsProps) => {
  const handleCommandAutocomplete = (cmd: (typeof commands)[0], word: string, index: number, actions: EditorRefActions) => {
    // Remove trigger char + word.
    actions.removeText(index, word.length);

    // If the command has a dialog action, invoke it instead of inserting text.
    if (cmd.action) {
      cmd.action();
      return;
    }

    // Otherwise insert the command output text.
    actions.insertText(cmd.run());
    // Position cursor relative to insertion point, if specified.
    if (cmd.cursorOffset) {
      actions.setCursorPosition(index + cmd.cursorOffset);
    }
  };

  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    editorActions,
    triggerChar: "/",
    items: commands,
    filterItems: (items, query) => (!query ? items : items.filter((cmd) => cmd.name.toLowerCase().startsWith(query))),
    onAutocomplete: handleCommandAutocomplete,
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
        <span className="tracking-wide">
          <span className="text-muted-foreground">/</span>
          {cmd.name}
        </span>
      )}
    />
  );
};

export default SlashCommands;
