import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { getLanguageFromFilename } from "../utils/mimeTypeResolver";

interface TextPreviewProps {
  src: string;
  filename: string;
  isLoading?: boolean;
}

export function TextPreview({ src, filename, isLoading }: TextPreviewProps) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const language = getLanguageFromFilename(filename);

  useEffect(() => {
    if (!src) return;

    setIsContentLoading(true);
    setError(null);
    setContent("");

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setIsContentLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsContentLoading(false);
      });
  }, [src]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || isContentLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Failed to load file: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Header with language and copy button */}
      <div className="flex justify-between items-center px-4 py-2 bg-muted border-b">
        <span className="text-sm text-muted-foreground font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:bg-accent rounded"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words bg-background min-h-full">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}
