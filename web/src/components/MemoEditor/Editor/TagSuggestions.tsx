import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { useTagStore } from "@/store/module";
import { EditorRefActions } from ".";

type Props = {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
};
type Position = { left: number; top: number; height: number };

const TagSuggestions = ({ editorRef, editorActions }: Props) => {
  const [position, setPosition] = useState<Position | null>(null);
  const hide = () => setPosition(null);

  const getCurrentWord = (): [word: string, startIndex: number] => {
    if (!editorRef.current) return ["", 0];
    const cursorPos = editorRef.current.selectionEnd;
    const before = editorRef.current.value.slice(0, cursorPos).match(/\S*$/) || { 0: "", index: cursorPos };
    const ahead = editorRef.current.value.slice(cursorPos).match(/^\S*/) || { 0: "" };
    return [before[0] + ahead[0], before.index || cursorPos];
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isArrowKey = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(e.code);
    if (isArrowKey || ["Tab", "Escape"].includes(e.code)) hide();
  };
  const handleInput = () => {
    if (!editorRef.current) return;
    const [word, index] = getCurrentWord();
    if (!word.startsWith("#") || word.slice(1).includes("#")) return hide();
    setPosition(getCaretCoordinates(editorRef.current, index));
  };

  const areListenersRegistered = useRef(false);
  const registerListeners = () => {
    if (!editorRef.current || areListenersRegistered.current) return;
    editorRef.current.addEventListener("click", hide);
    editorRef.current.addEventListener("blur", hide);
    editorRef.current.addEventListener("keydown", handleKeyDown);
    editorRef.current.addEventListener("input", handleInput);
    areListenersRegistered.current = true;
  };
  useEffect(registerListeners, [!!editorRef.current]);

  const { tags } = useTagStore().state;
  const getSuggestions = () => {
    const partial = getCurrentWord()[0].slice(1);
    return tags.filter((tag) => tag.startsWith(partial)).slice(0, 5);
  };
  const suggestions = getSuggestions();

  const handleSelection = (tag: string) => {
    if (!editorActions || !("current" in editorActions) || !editorActions.current) return;
    const partial = getCurrentWord()[0].slice(1);
    editorActions.current.insertText(tag.slice(partial.length));
  };

  if (!position || !suggestions.length) return null;
  return (
    <div
      className="z-2 p-1 absolute max-w-[12rem] rounded font-mono shadow bg-zinc-200 dark:bg-zinc-600"
      style={{ left: position.left - 6, top: position.top + position.height + 2 }}
    >
      {suggestions.map((tag) => (
        <div
          key={tag}
          onMouseDown={() => handleSelection(tag)}
          className="rounded p-1 px-2 w-full truncate text-sm dark:text-gray-300 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          #{tag}
        </div>
      ))}
    </div>
  );
};

export default TagSuggestions;
