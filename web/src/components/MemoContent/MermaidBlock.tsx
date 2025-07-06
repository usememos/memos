import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
}

const MermaidBlock: React.FC<Props> = ({ content }: Props) => {
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const mermaidDockBlock = useRef<null>(null);

  // Simple dark mode detection
  useEffect(() => {
    const updateMode = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setColorMode(isDark ? "dark" : "light");
    };

    updateMode();

    // Watch for changes to the dark class
    const observer = new MutationObserver(updateMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

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
    <pre
      ref={mermaidDockBlock}
      className="w-full p-2 whitespace-pre-wrap relative bg-card border border-border rounded text-card-foreground"
    >
      {content}
    </pre>
  );
};

export default MermaidBlock;
