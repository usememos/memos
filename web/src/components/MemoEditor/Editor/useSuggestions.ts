import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { EditorRefActions } from ".";

export interface Position {
  left: number;
  top: number;
  height: number;
}

export interface UseSuggestionsOptions<T> {
  /** Reference to the textarea element */
  editorRef: React.RefObject<HTMLTextAreaElement>;
  /** Reference to editor actions for text manipulation */
  editorActions: React.ForwardedRef<EditorRefActions>;
  /** Character that triggers the suggestions (e.g., '/', '#', '@') */
  triggerChar: string;
  /** Array of items to show in suggestions */
  items: T[];
  /** Function to filter items based on search query */
  filterItems: (items: T[], searchQuery: string) => T[];
  /** Callback when an item is selected for autocomplete */
  onAutocomplete: (item: T, word: string, startIndex: number, actions: EditorRefActions) => void;
}

export interface UseSuggestionsReturn<T> {
  /** Current position of the popup, or null if hidden */
  position: Position | null;
  /** Filtered suggestions based on current search */
  suggestions: T[];
  /** Index of the currently selected suggestion */
  selectedIndex: number;
  /** Whether the suggestions popup is visible */
  isVisible: boolean;
  /** Handler to select a suggestion item */
  handleItemSelect: (item: T) => void;
}

/**
 * Shared hook for managing suggestion popups in the editor.
 * Handles positioning, keyboard navigation, filtering, and autocomplete logic.
 *
 * Features:
 * - Auto-positioning based on caret location
 * - Keyboard navigation (Arrow Up/Down, Enter, Tab, Escape)
 * - Smart filtering based on trigger character
 * - Proper event cleanup
 *
 * @example
 * ```tsx
 * const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
 *   editorRef,
 *   editorActions,
 *   triggerChar: '#',
 *   items: tags,
 *   filterItems: (items, query) => items.filter(tag => tag.includes(query)),
 *   onAutocomplete: (tag, word, index, actions) => {
 *     actions.removeText(index, word.length);
 *     actions.insertText(`#${tag}`);
 *   },
 * });
 * ```
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
    if (!editorActions || !("current" in editorActions) || !editorActions.current) {
      console.warn("useSuggestions: editorActions not available for autocomplete");
      return;
    }
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
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.addEventListener("click", hide);
    editor.addEventListener("blur", hide);
    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("input", handleInput);

    return () => {
      editor.removeEventListener("click", hide);
      editor.removeEventListener("blur", hide);
      editor.removeEventListener("keydown", handleKeyDown);
      editor.removeEventListener("input", handleInput);
    };
  }, []); // Empty deps - editor ref is stable, handlers use refs for fresh values

  return {
    position,
    suggestions: suggestionsRef.current,
    selectedIndex,
    isVisible: isVisibleRef.current,
    handleItemSelect: handleAutocomplete,
  };
}
