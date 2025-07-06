import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import { CopyIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
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

  const handleCopyButtonClick = useCallback(() => {
    copy(content);
    toast.success("Copied to clipboard!");
  }, [content]);

  return (
    <div className="w-full my-1 bg-card border border-border rounded-md relative">
      <div className="w-full px-2 py-0.5 flex flex-row justify-between items-center text-muted-foreground">
        <span className="text-xs font-mono">{formatedLanguage}</span>
        <CopyIcon className="w-3 h-auto cursor-pointer hover:text-foreground" onClick={handleCopyButtonClick} />
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
