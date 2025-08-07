import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import OverflowTip from "@/components/kit/OverflowTip";
import { cn } from "@/lib/utils";
import { EditorRefActions } from ".";
import { Command } from "../types/command";

type Props = {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  commands: Command[];
};

type Position = { left: number; top: number; height: number };

const CommandSuggestions = observer(({ editorRef, editorActions, commands }: Props) => {
  const [position, setPosition] = useState<Position | null>(null);
  const [selected, select] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const hide = () => setPosition(null);

  const getCurrentWord = (): [word: string, startIndex: number] => {
    const editor = editorRef.current;
    if (!editor) return ["", 0];
    const cursorPos = editor.selectionEnd;
    const before = editor.value.slice(0, cursorPos).match(/\S*$/) || { 0: "", index: cursorPos };
    const after = editor.value.slice(cursorPos).match(/^\S*/) || { 0: "" };
    return [before[0] + after[0], before.index ?? cursorPos];
  };

  // Filter commands based on the current word after the slash
  const suggestionsRef = useRef<Command[]>([]);
  suggestionsRef.current = (() => {
    const [word] = getCurrentWord();
    if (!word.startsWith("/")) return [];
    const search = word.slice(1).toLowerCase();
    if (!search) return commands;
    return commands.filter((cmd) => cmd.name.toLowerCase().startsWith(search));
  })();

  const isVisibleRef = useRef(false);
  isVisibleRef.current = !!(position && suggestionsRef.current.length > 0);

  const autocomplete = (cmd: Command) => {
    if (!editorActions || !("current" in editorActions) || !editorActions.current) return;
    const [word, index] = getCurrentWord();
    editorActions.current.removeText(index, word.length);
    editorActions.current.insertText(cmd.run());
    if (cmd.cursorOffset) {
      editorActions.current.setCursorPosition(editorActions.current.getCursorPosition() + cmd.cursorOffset);
    }
    hide();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisibleRef.current) return;
    const suggestions = suggestionsRef.current;
    const selected = selectedRef.current;
    if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.code)) hide();
    if ("ArrowDown" === e.code) {
      select((selected + 1) % suggestions.length);
      e.preventDefault();
      e.stopPropagation();
    }
    if ("ArrowUp" === e.code) {
      select((selected - 1 + suggestions.length) % suggestions.length);
      e.preventDefault();
      e.stopPropagation();
    }
    if (["Enter", "Tab"].includes(e.code)) {
      autocomplete(suggestions[selected]);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    select(0);
    const [word, index] = getCurrentWord();
    const currentChar = editor.value[editor.selectionEnd];
    const isActive = word.startsWith("/") && currentChar !== "/";
    const caretCordinates = getCaretCoordinates(editor, index);
    caretCordinates.top -= editor.scrollTop;
    if (isActive) {
      setPosition(caretCordinates);
    } else {
      hide();
    }
  };

  const listenersAreRegisteredRef = useRef(false);
  const registerListeners = () => {
    const editor = editorRef.current;
    if (!editor || listenersAreRegisteredRef.current) return;
    editor.addEventListener("click", hide);
    editor.addEventListener("blur", hide);
    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("input", handleInput);
    listenersAreRegisteredRef.current = true;
  };
  useEffect(registerListeners, [!!editorRef.current]);

  if (!isVisibleRef.current || !position) return null;
  return (
    <div
      className="z-20 p-1 mt-1 -ml-2 absolute max-w-48 gap-px rounded font-mono flex flex-col justify-start items-start overflow-auto shadow bg-popover"
      style={{ left: position.left, top: position.top + position.height }}
    >
      {suggestionsRef.current.map((cmd, i) => (
        <div
          key={cmd.name}
          onMouseDown={() => autocomplete(cmd)}
          className={cn(
            "rounded p-1 px-2 w-full truncate text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
            i === selected ? "bg-accent text-accent-foreground" : "",
          )}
        >
          <OverflowTip>/{cmd.name}</OverflowTip>
          {cmd.description && <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>}
        </div>
      ))}
    </div>
  );
});

export default CommandSuggestions;
