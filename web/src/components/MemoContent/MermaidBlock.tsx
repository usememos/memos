import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const mermaidDockBlock = useRef<null>(null);
  mermaid.initialize({ startOnLoad: false, theme: "default" });

  useEffect(() => {
    if (!mermaidDockBlock.current) {
      return;
    }

    // Render mermaid when mounted.
    mermaid.run({
      nodes: [mermaidDockBlock.current],
    });
  });

  return (
    <pre ref={mermaidDockBlock} className="w-full p-2 whitespace-pre-wrap relative">
      {content}
    </pre>
  );
};

export default MermaidBlock;
