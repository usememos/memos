import { useEffect, useRef } from "react";
import { getSystemColorScheme } from "@/helpers/utils";
import { useCommonContext } from "@/layouts/CommonContextProvider";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const mermaidDockBlock = useRef<null>(null);
  const commonContext = useCommonContext();

  const handleMermaidTheme = () => {
    if (commonContext.appearance === "dark") {
      return "dark";
    } else if (commonContext.appearance === "light") {
      return "neutral";
    } else {
      if (getSystemColorScheme() === "dark") {
        return "dark";
      } else if (getSystemColorScheme() === "light") {
        return "neutral";
      } else {
        return "default";
      }
    }
  };
  useEffect(() => {
    // Dynamically import mermaid to ensure compatibility with Vite
    const initializeMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: handleMermaidTheme() });
      if (mermaidDockBlock.current) {
        mermaid.run({
          nodes: [mermaidDockBlock.current],
        });
      }
    };

    initializeMermaid();
  }, [content]);

  return (
    <pre ref={mermaidDockBlock} className="w-full p-2 whitespace-pre-wrap relative">
      {content}
    </pre>
  );
};

export default MermaidBlock;
