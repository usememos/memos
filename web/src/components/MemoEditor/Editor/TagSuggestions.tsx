import { useTagStore } from "@/store/module";
import { useEffect, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";

type Props = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};
type Coordinates = { left: number; top: number; height: number };

const TagSuggestions = ({ textareaRef }: Props) => {
  const [coord, setCoord] = useState<Coordinates | null>({ left: 0, top: 0, height: 0 });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!textareaRef.current) return;
    const isArrowKey = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(e.code);
    if (isArrowKey) {
      setCoord(null);
      return;
    }
    setCoord(getCaretCoordinates(textareaRef.current, textareaRef.current.selectionEnd));
  };

  const areListenersRegistered = useRef(false);
  const registerListeners = () => {
    if (!textareaRef.current || areListenersRegistered.current) return;
    textareaRef.current.addEventListener("keydown", handleKeyDown);
    textareaRef.current.addEventListener("click", () => setCoord(null));
    areListenersRegistered.current = true;
  };
  useEffect(registerListeners, [!!textareaRef.current]);

  const { tags } = useTagStore().state;

  if (!coord) return null;
  return (
    <div
      className="z-2 absolute rounded font-mono bg-zinc-200 dark:bg-zinc-600"
      style={{ left: coord.left, top: coord.top + coord.height }}
    >
      {tags.map((tag) => (
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
