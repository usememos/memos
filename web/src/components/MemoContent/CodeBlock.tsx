import copy from "copy-to-clipboard";
import { escape as escapeHTML } from "lodash-es";
import { CheckIcon, CopyIcon } from "lucide-react";
import { isValidElement, type ReactElement, type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getThemeWithFallback, resolveTheme } from "@/utils/theme";
import { ensureHighlightTheme, highlightCode, isPlainTextLanguage } from "./highlight";
import { MermaidBlock } from "./MermaidBlock";
import type { ReactMarkdownProps } from "./markdown/types";
import { extractCodeContent, extractLanguage } from "./utils";

interface CodeBlockProps extends ReactMarkdownProps {
  children?: ReactNode;
  className?: string;
}

export const CodeBlock = ({ children, className, node: _node, ...props }: CodeBlockProps) => {
  const codeElement = isValidElement(children) ? (children as ReactElement<{ className?: string }>) : null;
  const codeClassName = codeElement?.props.className || "";
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

  // Keying on the inputs remounts the block when they change, so highlight state
  // can never be shown against a different code content.
  return <HighlightedCodeBlock key={`${language}\u0000${codeContent}`} codeContent={codeContent} language={language} />;
};

interface HighlightedCodeBlockProps {
  codeContent: string;
  language: string;
}

const HighlightedCodeBlock = ({ codeContent, language }: HighlightedCodeBlockProps) => {
  const { userGeneralSetting } = useAuth();
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string>();
  const renderedCode = highlightedCode ?? escapeHTML(codeContent);

  const theme = getThemeWithFallback(userGeneralSetting?.theme);
  const resolvedTheme = resolveTheme(theme);
  const isDarkTheme = resolvedTheme.includes("dark");

  useEffect(() => {
    if (isPlainTextLanguage(language)) {
      return;
    }

    void ensureHighlightTheme(isDarkTheme);
  }, [isDarkTheme, language]);

  useEffect(() => {
    if (isPlainTextLanguage(language)) {
      // The escaped fallback already is the final output; skip the async round-trip.
      return;
    }

    let cancelled = false;

    void highlightCode(codeContent, language)
      .then((value) => {
        if (!cancelled) {
          setHighlightedCode(value);
        }
      })
      .catch(() => {
        // Keep the escaped plain-text fallback when a language chunk cannot load.
      });

    return () => {
      cancelled = true;
    };
  }, [codeContent, language]);

  const handleCopy = async () => {
    try {
      // Try native clipboard API first (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(codeContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback to copy-to-clipboard library for non-secure contexts
        const success = await copy(codeContent);
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
      const success = await copy(codeContent);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error("Failed to copy code:", err);
      }
    }
  };

  return (
    <pre className="relative my-2 rounded-lg border border-border bg-muted/20 overflow-hidden">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30">
        <span className="text-xs text-foreground select-none">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
            "transition-colors duration-200",
            "hover:bg-accent active:scale-95",
            copied ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <code
          className={cn("block px-3 py-2 text-sm leading-relaxed", `language-${language}`)}
          dangerouslySetInnerHTML={{ __html: renderedCode }}
        />
      </div>
    </pre>
  );
};
