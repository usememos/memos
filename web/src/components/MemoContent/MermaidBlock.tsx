import { useColorScheme } from "@mui/joy";
import { useEffect, useRef } from "react";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const { mode: colorMode } = useColorScheme();
  const mermaidDockBlock = useRef<null>(null);

  useEffect(() => {
    // Dynamically import mermaid to ensure compatibility with Vite
    const initializeMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: colorMode == "dark" ? "dark" : "default" });
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
