import mermaid from "mermaid";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { instanceStore, userStore } from "@/store";
import { resolveTheme, setupSystemThemeListener } from "@/utils/theme";

interface MermaidBlockProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Maps app theme to Mermaid theme
 */
const getMermaidTheme = (appTheme: string): "default" | "dark" => {
  return appTheme === "default-dark" ? "dark" : "default";
};

export const MermaidBlock = observer(({ children, className }: MermaidBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [systemThemeChange, setSystemThemeChange] = useState(0);

  // Extract Mermaid code content from children
  const codeElement = children as React.ReactElement;
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  // Get theme preference (reactive via MobX observer)
  const themePreference = userStore.state.userGeneralSetting?.theme || instanceStore.state.theme;

  // Resolve theme to actual value (handles "system" theme + system theme changes)
  const currentTheme = useMemo(() => resolveTheme(themePreference), [themePreference, systemThemeChange]);

  // Listen for OS theme changes when using "system" theme preference
  useEffect(() => {
    if (themePreference !== "system") {
      return;
    }

    return setupSystemThemeListener(() => {
      setSystemThemeChange((prev) => prev + 1);
    });
  }, [themePreference]);

  // Render Mermaid diagram when content or theme changes
  useEffect(() => {
    if (!codeContent || !containerRef.current) {
      return;
    }

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;
        const mermaidTheme = getMermaidTheme(currentTheme);

        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: "strict",
          fontFamily: "inherit",
        });

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
