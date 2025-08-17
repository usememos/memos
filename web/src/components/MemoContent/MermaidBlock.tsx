import { useEffect, useRef } from "react";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const mermaidDockBlock = useRef<null>(null);

  useEffect(() => {
    const initializeMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      if (mermaidDockBlock.current) {
        mermaid.run({
          nodes: [mermaidDockBlock.current],
        });
      }
    };

    initializeMermaid();
  }, [content]);

  return (
    <pre
      ref={mermaidDockBlock}
      className="w-full p-2 whitespace-pre-wrap relative bg-card border border-border rounded text-card-foreground"
    >
      {content}
    </pre>
  );
};

export default MermaidBlock;
