import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { CheckIcon, CopyIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { instanceStore } from "@/store";
import { MermaidBlock } from "./MermaidBlock";

interface PreProps {
  children?: React.ReactNode;
  className?: string;
}

export const CodeBlock = observer(({ children, className, ...props }: PreProps) => {
  const [copied, setCopied] = useState(false);

  // Extract the code element and its props
  const codeElement = children as React.ReactElement;
  const codeClassName = codeElement?.props?.className || "";
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  // Extract language from className (format: language-xxx)
  const match = /language-(\w+)/.exec(codeClassName);
  const language = match ? match[1] : "";

  // If it's a mermaid block, render with MermaidBlock component
  if (language === "mermaid") {
    return (
      <MermaidBlock className={className} {...props}>
        {children}
      </MermaidBlock>
    );
  }

  // If it's __html special language, render sanitized HTML
  if (language === "__html") {
    const sanitizedHTML = DOMPurify.sanitize(codeContent, {
      ALLOWED_TAGS: [
        "div",
        "span",
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "strike",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "code",
        "pre",
        "ul",
        "ol",
        "li",
        "dl",
        "dt",
        "dd",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "a",
        "img",
        "figure",
        "figcaption",
        "hr",
        "small",
        "sup",
        "sub",
      ],
      ALLOWED_ATTR: "href title alt src width height class id style target rel colspan rowspan".split(" "),
      FORBID_ATTR: "onerror onload onclick onmouseover onfocus onblur onchange".split(" "),
      FORBID_TAGS: "script iframe object embed form input button".split(" "),
    });

    return (
      <div
        className="w-full overflow-auto my-2!"
        dangerouslySetInnerHTML={{
          __html: sanitizedHTML,
        }}
      />
    );
  }

  const appTheme = instanceStore.state.theme;
  const isDarkTheme = appTheme.includes("dark");

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
  }, [appTheme, isDarkTheme]);

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
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <pre className="relative group">
      <div className="w-full flex flex-row justify-between items-center">
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider select-none">{language}</span>
        <button
          onClick={handleCopy}
          className={cn("p-1.5 rounded-md transition-all", "hover:bg-accent/50", copied ? "text-primary" : "text-muted-foreground")}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className={className} {...props}>
        <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </div>
    </pre>
  );
});
