import copy from "copy-to-clipboard";
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
  if (formatedLanguage === SpecialLanguage.HTML) {
    return (
      <div
        className="w-full overflow-auto my-2!"
        dangerouslySetInnerHTML={{
          __html: content,
        }}
      />
    );
  } else if (formatedLanguage === SpecialLanguage.MERMAID) {
    return <MermaidBlock content={content} />;
  }

  useEffect(() => {
    const dynamicImportStyle = async () => {
      const isDark = document.documentElement.classList.contains("dark");

      // Remove any existing highlight.js style
      const existingStyle = document.querySelector("style[data-hljs-theme]");
      if (existingStyle) {
        existingStyle.remove();
      }

      try {
        // Dynamically import the appropriate CSS.
        const cssModule = isDark
          ? await import("highlight.js/styles/atom-one-dark.css?inline")
          : await import("highlight.js/styles/github.css?inline");

        // Create and inject the style
        const style = document.createElement("style");
        style.textContent = cssModule.default;
        style.setAttribute("data-hljs-theme", isDark ? "dark" : "light");
        document.head.appendChild(style);
      } catch (error) {
        console.warn("Failed to load highlight.js theme:", error);
      }
    };

    dynamicImportStyle();

    // Watch for changes to the dark class
    const observer = new MutationObserver(dynamicImportStyle);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
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
