import clsx from "clsx";
import { useState } from "react";

interface Props {
  content: string;
}

const Spoiler: React.FC<Props> = ({ content }: Props) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <span
      className={clsx("inline cursor-pointer select-none", isRevealed ? "" : "bg-gray-200 dark:bg-zinc-700")}
      onClick={() => setIsRevealed(!isRevealed)}
    >
      <span className={clsx(isRevealed ? "opacity-100" : "opacity-0")}>{content}</span>
    </span>
  );
};

export default Spoiler;
