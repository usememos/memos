import mermaid from "mermaid";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getThemeWithFallback, resolveTheme, setupSystemThemeListener } from "@/utils/theme";
import { extractCodeContent } from "./utils";

interface MermaidBlockProps {
  children?: React.ReactNode;
  className?: string;
}

type MermaidTheme = "default" | "dark";

const toMermaidTheme = (appTheme: string): MermaidTheme => (appTheme === "default-dark" ? "dark" : "default");

const formatErrorMessage = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : "Failed to render diagram";
  if (/no diagram type detected/i.test(msg)) {
    return `${msg} — check that the diagram type is valid (e.g. sequenceDiagram, classDiagram, erDiagram)`;
  }
  return msg;
};

export const MermaidBlock = ({ children, className }: MermaidBlockProps) => {
  const { userGeneralSetting } = useAuth();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [systemThemeChange, setSystemThemeChange] = useState(0);

  const codeContent = extractCodeContent(children);
  const themePreference = getThemeWithFallback(userGeneralSetting?.theme);
  const currentTheme = useMemo(() => resolveTheme(themePreference), [themePreference, systemThemeChange]);

  // Re-resolve theme when OS preference changes (only relevant when using "system" theme)
  useEffect(() => {
    if (themePreference !== "system") return;
    return setupSystemThemeListener(() => setSystemThemeChange((n) => n + 1));
  }, [themePreference]);

  // Initialize Mermaid when theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: toMermaidTheme(currentTheme),
      securityLevel: "strict",
      fontFamily: "inherit",
      suppressErrorRendering: true,
    });
  }, [currentTheme]);

  // Render diagram when content or theme changes
  useEffect(() => {
    if (!codeContent) return;

    const id = `mermaid-${Math.random().toString(36).substring(7)}`;

    mermaid
      .render(id, codeContent)
      .then(({ svg: renderedSvg }) => {
        setSvg(renderedSvg);
        setError("");
      })
      .catch((err) => {
        console.error("Failed to render mermaid diagram:", err);
        setSvg("");
        setError(formatErrorMessage(err));
      });
  }, [codeContent, currentTheme]);

  if (error) {
    return (
      <div className="w-full">
        <div className="text-sm text-destructive mb-2 whitespace-normal break-words">Mermaid Error: {error}</div>
        <code className="block language-mermaid whitespace-pre text-sm">{codeContent}</code>
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div
      className={cn("mermaid-diagram w-full flex justify-center items-center my-2 overflow-x-auto", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
