import mermaid from "mermaid";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { instanceStore, userStore } from "@/store";
import { resolveTheme } from "@/utils/theme";

interface MermaidBlockProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Maps app theme to Mermaid theme
 * @param appTheme - The resolved app theme
 * @returns Mermaid theme name
 */
const getMermaidTheme = (appTheme: string): "default" | "dark" => {
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

export const MermaidBlock = observer(({ children, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Extract the code element and its content
  const codeElement = children as React.ReactElement;
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  // Get current theme from store (reactive via MobX observer)
  // This will automatically trigger re-render when theme changes
  const currentTheme = useMemo(() => {
    const userTheme = userStore.state.userGeneralSetting?.theme;
    const instanceTheme = instanceStore.state.theme;
    const theme = userTheme || instanceTheme;
    return resolveTheme(theme);
  }, [userStore.state.userGeneralSetting?.theme, instanceStore.state.theme]);

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
});
