import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { EditorRefActions } from ".";

export interface Position {
  left: number;
  top: number;
  height: number;
}

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
  const isProcessingRef = useRef(false);

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
      console.warn("useSuggestions: editorActions not available");
      return;
    }
    isProcessingRef.current = true;
    const [word, index] = getCurrentWord();
    onAutocomplete(item, word, index, editorActions.current);
    hide();
    // Re-enable input handling after all DOM operations complete
    queueMicrotask(() => {
      isProcessingRef.current = false;
    });
  };

  const handleNavigation = (e: KeyboardEvent, selected: number, suggestionsCount: number) => {
    if (e.code === "ArrowDown") {
      setSelectedIndex((selected + 1) % suggestionsCount);
      e.preventDefault();
      e.stopPropagation();
    } else if (e.code === "ArrowUp") {
      setSelectedIndex((selected - 1 + suggestionsCount) % suggestionsCount);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisibleRef.current) return;

    const suggestions = suggestionsRef.current;
    const selected = selectedRef.current;

    if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      hide();
      return;
    }

    if (["ArrowDown", "ArrowUp"].includes(e.code)) {
      handleNavigation(e, selected, suggestions.length);
      return;
    }

    if (["Enter", "Tab"].includes(e.code)) {
      handleAutocomplete(suggestions[selected]);
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  const handleInput = () => {
    if (isProcessingRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    setSelectedIndex(0);
    const [word, index] = getCurrentWord();
    const currentChar = editor.value[editor.selectionEnd];
    const isActive = word.startsWith(triggerChar) && currentChar !== triggerChar;

    if (isActive) {
      const coords = getCaretCoordinates(editor, index);
      coords.top -= editor.scrollTop;
      setPosition(coords);
    } else {
      hide();
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlers = { click: hide, blur: hide, keydown: handleKeyDown, input: handleInput };
    Object.entries(handlers).forEach(([event, handler]) => {
      editor.addEventListener(event, handler as EventListener);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        editor.removeEventListener(event, handler as EventListener);
      });
    };
  }, []);

  return {
    position,
    suggestions: suggestionsRef.current,
    selectedIndex,
    isVisible: isVisibleRef.current,
    handleItemSelect: handleAutocomplete,
  };
}
