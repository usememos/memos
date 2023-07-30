import { useTagStore } from "@/store/module";
import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";

type Props = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};
type Position = { left: number; top: number; height: number };

const TagSuggestions = ({ textareaRef }: Props) => {
  const [position, setPosition] = useState<Position | null>(null);
  const hide = () => setPosition(null);

  const getCurrentWord = (): [word: string, startIndex: number] => {
    if (!textareaRef.current) return ["", 0];
    const cursorPos = textareaRef.current.selectionEnd;
    const before = textareaRef.current.value.slice(0, cursorPos).match(/\S*$/) || {0: "", index: cursorPos};
    const ahead = textareaRef.current.value.slice(cursorPos).match(/^\S*/) || {0: ""};
    return [before[0] + ahead[0], before.index || cursorPos];
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isArrowKey = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(e.code);
    if (isArrowKey || ['Tab', 'Escape'].includes(e.code)) hide();
  };
  const handleInput = () => {
    if (!textareaRef.current) return;
    const [word, index] = getCurrentWord();
    if (!word.startsWith("#") || word.slice(1).includes("#")) return hide();
    setPosition(getCaretCoordinates(textareaRef.current, index));
  };

  const areListenersRegistered = useRef(false);
  const registerListeners = () => {
    if (!textareaRef.current || areListenersRegistered.current) return;
    textareaRef.current.addEventListener("click", hide);
    textareaRef.current.addEventListener("blur", hide);
    textareaRef.current.addEventListener("keydown", handleKeyDown);
    textareaRef.current.addEventListener("input", handleInput);
    areListenersRegistered.current = true;
  };
  useEffect(registerListeners, [!!textareaRef.current]);

  const { tags } = useTagStore().state;
  const getSuggestions = () => {
    const phrase = getCurrentWord()[0].slice(1);
    return tags.filter((tag) => tag.startsWith(phrase)).slice(0, 5);
  }
  const suggestions = getSuggestions();

  if (!position || !suggestions.length) return null;
  return (
    <div
      className="z-2 absolute rounded font-mono bg-zinc-200 dark:bg-zinc-600"
      style={{ left: position.left - 6, top: position.top + position.height + 2 }}
    >
      {suggestions.map((tag) => (
        <div
          key={tag}
          className="rounded p-1 px-2 z-1000 text-sm dark:text-gray-300 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          #{tag}
        </div>
      ))}
    </div>
  );
};

export default TagSuggestions;
