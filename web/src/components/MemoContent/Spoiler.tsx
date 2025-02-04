import { useState } from "react";
import { cn } from "@/utils";

interface Props {
  content: string;
}

const Spoiler: React.FC<Props> = ({ content }: Props) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <span
      className={cn("inline cursor-pointer select-none", isRevealed ? "" : "bg-gray-200 dark:bg-zinc-700")}
      onClick={() => setIsRevealed(!isRevealed)}
    >
      <span className={cn(isRevealed ? "opacity-100" : "opacity-0")}>{content}</span>
    </span>
  );
};

export default Spoiler;
