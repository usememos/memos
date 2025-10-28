import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PreProps {
  children?: React.ReactNode;
  className?: string;
}

export const CodeBlock = ({ children, className, ...props }: PreProps) => {
  const [copied, setCopied] = useState(false);

  // Extract the code element and its props
  const codeElement = children as React.ReactElement;
  const codeClassName = codeElement?.props?.className || "";
  const codeContent = String(codeElement?.props?.children || "").replace(/\n$/, "");

  // Extract language from className (format: language-xxx)
  const match = /language-(\w+)/.exec(codeClassName);
  const language = match ? match[1] : "";

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
          className={cn(
            "p-1.5 rounded-md transition-all",
            "hover:bg-accent/50",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            copied ? "text-primary" : "text-muted-foreground",
          )}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className={className} {...props}>
        {children}
      </div>
    </pre>
  );
};
