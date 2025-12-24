import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getThemeWithFallback, resolveTheme } from "@/utils/theme";
import { MermaidBlock } from "./MermaidBlock";
import { extractCodeContent, extractLanguage } from "./utils";

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export const CodeBlock = ({ children, className, ...props }: CodeBlockProps) => {
  const { userGeneralSetting } = useAuth();
  const [copied, setCopied] = useState(false);

  const codeElement = children as React.ReactElement;
  const codeClassName = codeElement?.props?.className || "";
  const codeContent = extractCodeContent(children);
  const language = extractLanguage(codeClassName);

  // If it's a mermaid block, render with MermaidBlock component
  if (language === "mermaid") {
    return (
      <pre className="relative">
        <MermaidBlock className={cn(className)} {...props}>
          {children}
        </MermaidBlock>
      </pre>
    );
  }

  const theme = getThemeWithFallback(userGeneralSetting?.theme);
  const resolvedTheme = resolveTheme(theme);
  const isDarkTheme = resolvedTheme.includes("dark");

  // Dynamically load highlight.js theme based on app theme
  useEffect(() => {
    const dynamicImportStyle = async () => {
      // Remove any existing highlight.js style
      const existingStyle = document.querySelector("style[data-hljs-theme]");
      if (existingStyle) {
        existingStyle.remove();
      }

      try {
        const cssModule = isDarkTheme
          ? await import("highlight.js/styles/github-dark-dimmed.css?inline")
          : await import("highlight.js/styles/github.css?inline");

        // Create and inject the style
        const style = document.createElement("style");
        style.textContent = cssModule.default;
        style.setAttribute("data-hljs-theme", isDarkTheme ? "dark" : "light");
        document.head.appendChild(style);
      } catch (error) {
        console.warn("Failed to load highlight.js theme:", error);
      }
    };

    dynamicImportStyle();
  }, [resolvedTheme, isDarkTheme]);

  // Highlight code using highlight.js
  const highlightedCode = useMemo(() => {
    try {
      const lang = hljs.getLanguage(language);
      if (lang) {
        return hljs.highlight(codeContent, {
          language: language,
        }).value;
      }
    } catch {
      // Skip error and use default highlighted code.
    }

    // Escape any HTML entities when rendering original content.
    return Object.assign(document.createElement("span"), {
      textContent: codeContent,
    }).innerHTML;
  }, [language, codeContent]);

  const handleCopy = async () => {
    try {
      // Try native clipboard API first (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(codeContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback to copy-to-clipboard library for non-secure contexts
        const success = copy(codeContent);
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          console.error("Failed to copy code");
        }
      }
    } catch (err) {
      // If native API fails, try fallback
      console.warn("Native clipboard failed, using fallback:", err);
      const success = copy(codeContent);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error("Failed to copy code:", err);
      }
    }
  };

  return (
    <pre className="relative">
      <div className="absolute right-2 leading-3 top-1.5 flex flex-row justify-end items-center gap-1 opacity-60 hover:opacity-80">
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider select-none">{language}</span>
        <button
          onClick={handleCopy}
          className={cn("rounded-md transition-all", "hover:bg-accent/50", copied ? "text-primary" : "text-muted-foreground")}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
        </button>
      </div>
      <div className={className} {...props}>
        <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </div>
    </pre>
  );
};
