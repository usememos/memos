import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidBlockProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Maps app theme to Mermaid theme
 * @param appTheme - The app's theme value from data-theme attribute
 * @returns Mermaid theme name
 */
const getMermaidTheme = (appTheme: string | null): "default" | "dark" => {
  switch (appTheme) {
    case "default-dark":
      return "dark";
    case "default":
    case "paper":
    case "whitewall":
    default:
      return "default";
  }
};

/**
 * Gets the current theme from the document
 */
const getCurrentTheme = (): string => {
  return document.documentElement.getAttribute("data-theme") || "default";
};

export const MermaidBlock = ({ children, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [currentTheme, setCurrentTheme] = useState<string>(getCurrentTheme());

  // Extract the code element and its content
  const codeElement = children as React.ReactElement;
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
          const newTheme = getCurrentTheme();
          setCurrentTheme(newTheme);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  // Render diagram when content or theme changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!codeContent || !containerRef.current) {
        return;
      }

      try {
        // Generate a unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Get the appropriate Mermaid theme for current app theme
        const mermaidTheme = getMermaidTheme(currentTheme);

        // Initialize mermaid with current theme
        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: "strict",
          fontFamily: "inherit",
        });

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
  }, [codeContent, currentTheme]);

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
