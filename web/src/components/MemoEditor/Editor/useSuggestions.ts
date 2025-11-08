import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { EditorRefActions } from ".";

export type Position = { left: number; top: number; height: number };

export interface UseSuggestionsOptions<T> {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  triggerChar: string;
  items: T[];
  filterItems: (items: T[], searchQuery: string) => T[];
  onAutocomplete: (item: T, word: string, startIndex: number, actions: EditorRefActions) => void;
}

export interface UseSuggestionsReturn<T> {
  position: Position | null;
  suggestions: T[];
  selectedIndex: number;
  isVisible: boolean;
  handleItemSelect: (item: T) => void;
}

/**
 * Shared hook for managing suggestion popups in the editor.
 * Handles positioning, keyboard navigation, filtering, and autocomplete logic.
 */
export function useSuggestions<T>({
  editorRef,
  editorActions,
  triggerChar,
  items,
  filterItems,
  onAutocomplete,
}: UseSuggestionsOptions<T>): UseSuggestionsReturn<T> {
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Use refs to avoid stale closures in event handlers
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;

  const getCurrentWord = (): [word: string, startIndex: number] => {
    const editor = editorRef.current;
    if (!editor) return ["", 0];
    const cursorPos = editor.selectionEnd;
    const before = editor.value.slice(0, cursorPos).match(/\S*$/) || { 0: "", index: cursorPos };
    const after = editor.value.slice(cursorPos).match(/^\S*/) || { 0: "" };
    return [before[0] + after[0], before.index ?? cursorPos];
  };

  const hide = () => setPosition(null);

  // Filter items based on the current word after the trigger character
  const suggestionsRef = useRef<T[]>([]);
  suggestionsRef.current = (() => {
    const [word] = getCurrentWord();
    if (!word.startsWith(triggerChar)) return [];
    const searchQuery = word.slice(triggerChar.length).toLowerCase();
    return filterItems(items, searchQuery);
  })();

  const isVisibleRef = useRef(false);
  isVisibleRef.current = !!(position && suggestionsRef.current.length > 0);

  const handleAutocomplete = (item: T) => {
    if (!editorActions || !("current" in editorActions) || !editorActions.current) return;
    const [word, index] = getCurrentWord();
    onAutocomplete(item, word, index, editorActions.current);
    hide();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisibleRef.current) return;

    const suggestions = suggestionsRef.current;
    const selected = selectedRef.current;

    // Hide on Escape or horizontal arrows
    if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      hide();
      return;
    }

    // Navigate down
    if (e.code === "ArrowDown") {
      setSelectedIndex((selected + 1) % suggestions.length);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Navigate up
    if (e.code === "ArrowUp") {
      setSelectedIndex((selected - 1 + suggestions.length) % suggestions.length);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Accept suggestion
    if (["Enter", "Tab"].includes(e.code)) {
      handleAutocomplete(suggestions[selected]);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setSelectedIndex(0);
    const [word, index] = getCurrentWord();
    const currentChar = editor.value[editor.selectionEnd];
    const isActive = word.startsWith(triggerChar) && currentChar !== triggerChar;

    if (isActive) {
      const caretCoordinates = getCaretCoordinates(editor, index);
      caretCoordinates.top -= editor.scrollTop;
      setPosition(caretCoordinates);
    } else {
      hide();
    }
  };

  // Register event listeners
  const listenersRegisteredRef = useRef(false);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || listenersRegisteredRef.current) return;

    editor.addEventListener("click", hide);
    editor.addEventListener("blur", hide);
    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("input", handleInput);
    listenersRegisteredRef.current = true;

    return () => {
      editor.removeEventListener("click", hide);
      editor.removeEventListener("blur", hide);
      editor.removeEventListener("keydown", handleKeyDown);
      editor.removeEventListener("input", handleInput);
      listenersRegisteredRef.current = false;
    };
  }, [editorRef.current]);

  return {
    position,
    suggestions: suggestionsRef.current,
    selectedIndex,
    isVisible: isVisibleRef.current,
    handleItemSelect: handleAutocomplete,
  };
}
