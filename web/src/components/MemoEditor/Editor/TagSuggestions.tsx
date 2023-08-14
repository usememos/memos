import classNames from "classnames";
import { KeyboardEvent, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { useTagStore } from "@/store/module";
import { EditorRefActions } from ".";

type Props = {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  children: React.ReactNode;
};
type Position = { left: number; top: number; height: number };

const TagSuggestions = ({ children, editorRef, editorActions }: Props) => {
  const { tags } = useTagStore().state;
  const [selected, select] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);

  const hide = () => setPosition(null);

  const getCurrentWord = (): [word: string, startIndex: number] => {
    if (!editorRef.current) return ["", 0];
    const cursorPos = editorRef.current.selectionEnd;
    const before = editorRef.current.value.slice(0, cursorPos).match(/\S*$/) || { 0: "", index: cursorPos };
    const ahead = editorRef.current.value.slice(cursorPos).match(/^\S*/) || { 0: "" };
    return [before[0] + ahead[0], before.index || cursorPos];
  };

  const suggestions = (() => {
    const partial = getCurrentWord()[0].slice(1).toLowerCase();
    return tags.filter((tag) => tag.toLowerCase().startsWith(partial)).slice(0, 5);
  })();

  const handleKeyDown = (e: KeyboardEvent) => {
    if ("ArrowDown" === e.code) {
      select((selected + 1) % suggestions.length);
      e.preventDefault();
    }
    if ("ArrowUp" === e.code) {
      select((selected - 1) % suggestions.length);
      e.preventDefault();
    }
    if (["ArrowLeft", "ArrowRight", "Tab", "Escape"].includes(e.code)) hide();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    select(0);
    const [word, index] = getCurrentWord();
    const isActive = word.startsWith("#") && !word.slice(1).includes("#");
    isActive ? setPosition(getCaretCoordinates(editorRef.current, index)) : hide();
  };

  const autocomplete = (tag: string) => {
    if (!editorActions || !("current" in editorActions) || !editorActions.current) return;
    const [word, index] = getCurrentWord();
    editorActions.current.removeText(index, word.length);
    editorActions.current.insertText(`#${tag}`);
  };

  const isVisible = position && suggestions.length > 0;

  return (
    <div className="w-full flex flex-col" onClick={hide} onBlur={hide} onKeyDown={handleKeyDown} onInput={handleInput}>
      {children}
      {isVisible && (
        <div
          className="z-2 p-1 absolute max-w-[12rem] rounded font-mono shadow bg-zinc-200 dark:bg-zinc-600"
          style={{ left: position.left - 6, top: position.top + position.height + 2 }}
        >
          {suggestions.map((tag, i) => (
            <div
              key={tag}
              onMouseDown={() => autocomplete(tag)}
              className={classNames(
                "rounded p-1 px-2 w-full truncate text-sm dark:text-gray-300 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700",
                i === selected ? "bg-zinc-300 dark:bg-zinc-700" : ""
              )}
            >
              #{tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagSuggestions;
