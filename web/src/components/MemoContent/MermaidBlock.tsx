import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface Props {
  __html: string;
}

const MermaidBlock: React.FC<Props> = ({ __html }: Props) => {
  const mermaidDockBlock = useRef<null>(null);

  useEffect(() => {
    if (!mermaidDockBlock.current) {
      return;
    }

    // Render mermaid when mounted
    mermaid.run({
      nodes: [mermaidDockBlock.current],
    });
  });

  return <pre ref={mermaidDockBlock} className="w-full p-2 whitespace-pre-wrap relative" dangerouslySetInnerHTML={{ __html }}></pre>;
};

export default MermaidBlock;
