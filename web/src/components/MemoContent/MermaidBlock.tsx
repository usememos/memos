import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidBlockProps {
  children?: React.ReactNode;
  className?: string;
}

// Initialize mermaid with default configuration
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "strict",
  fontFamily: "inherit",
});

export const MermaidBlock = ({ children, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Extract the code element and its content
  const codeElement = children as React.ReactElement;
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  useEffect(() => {
    const renderDiagram = async () => {
      if (!codeContent || !containerRef.current) {
        return;
      }

      try {
        // Generate a unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Render the mermaid diagram
        const { svg: renderedSvg } = await mermaid.render(id, codeContent);
        setSvg(renderedSvg);
        setError("");
      } catch (err) {
        console.error("Failed to render mermaid diagram:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderDiagram();
  }, [codeContent]);

  // If there's an error, fall back to showing the code
  if (error) {
    return (
      <div className="w-full">
        <div className="text-sm text-destructive mb-2">Mermaid Error: {error}</div>
        <pre className={className}>
          <code className="language-mermaid">{codeContent}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("mermaid-diagram w-full flex justify-center items-center my-4 overflow-x-auto", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
