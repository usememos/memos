import { useEffect, useRef } from "react";
import { useCommonContext } from "@/layouts/CommonContextProvider";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const mermaidDockBlock = useRef<null>(null);
  const commonContext = useCommonContext();
  useEffect(() => {
    // Dynamically import mermaid to ensure compatibility with Vite
    const initializeMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: commonContext.appearance === "dark" ? "dark" : "default" });
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
