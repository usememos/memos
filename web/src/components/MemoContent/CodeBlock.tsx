import copy from "copy-to-clipboard";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { CopyIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import MermaidBlock from "./MermaidBlock";
import { BaseProps } from "./types";

// Special languages that are rendered differently.
enum SpecialLanguage {
  HTML = "__html",
  MERMAID = "mermaid",
}

interface Props extends BaseProps {
  language: string;
  content: string;
}

const CodeBlock: React.FC<Props> = ({ language, content }: Props) => {
  const formatedLanguage = useMemo(() => (language || "").toLowerCase() || "text", [language]);

  // Users can set Markdown code blocks as `__html` to render HTML directly.
  // Content is sanitized to prevent XSS attacks while preserving safe HTML.
  if (formatedLanguage === SpecialLanguage.HTML) {
    const sanitizedHTML = DOMPurify.sanitize(content, {
      // Allow common safe HTML tags and attributes
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
      // Forbid dangerous attributes and tags
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
  } else if (formatedLanguage === SpecialLanguage.MERMAID) {
    return <MermaidBlock content={content} />;
  }

  useEffect(() => {
    const dynamicImportStyle = async () => {
      // Remove any existing highlight.js style
      const existingStyle = document.querySelector("style[data-hljs-theme]");
      if (existingStyle) {
        existingStyle.remove();
      }

      try {
        // Always use the github light theme
        const cssModule = await import("highlight.js/styles/github.css?inline");

        // Create and inject the style
        const style = document.createElement("style");
        style.textContent = cssModule.default;
        style.setAttribute("data-hljs-theme", "light");
        document.head.appendChild(style);
      } catch (error) {
        console.warn("Failed to load highlight.js theme:", error);
      }
    };

    dynamicImportStyle();
  }, []);

  const highlightedCode = useMemo(() => {
    try {
      const lang = hljs.getLanguage(formatedLanguage);
      if (lang) {
        return hljs.highlight(content, {
          language: formatedLanguage,
        }).value;
      }
    } catch {
      // Skip error and use default highlighted code.
    }

    // Escape any HTML entities when rendering original content.
    return Object.assign(document.createElement("span"), {
      textContent: content,
    }).innerHTML;
  }, [formatedLanguage, content]);

  const copyContent = () => {
    copy(content);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="w-full my-1 bg-card border border-border rounded-md relative">
      <div className="w-full px-2 py-0.5 flex flex-row justify-between items-center text-muted-foreground">
        <span className="text-xs font-mono">{formatedLanguage}</span>
        <CopyIcon className="w-3 h-auto cursor-pointer hover:text-foreground" onClick={copyContent} />
      </div>

      <div className="overflow-auto">
        <pre className={cn("no-wrap overflow-auto", "w-full p-2 bg-muted/50 relative")}>
          <code
            className={cn(`language-${formatedLanguage}`, "block text-sm leading-5 text-foreground")}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          ></code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
