import { Link } from "react-router-dom";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";

interface MemoSnippetLinkProps {
  name: string;
  snippet: string;
  to: string;
  state?: object;
  className?: string;
}

const MemoSnippetLink = ({ name, snippet, to, state, className }: MemoSnippetLinkProps) => {
  const memoId = extractMemoIdFromName(name);

  return (
    <Link
      className={cn(
        "flex items-center gap-1 px-1 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors group",
        className,
      )}
      to={to}
      viewTransition
      state={state}
    >
      <span className="text-[8px] font-mono px-1 py-0.5 rounded border border-border bg-muted/40 group-hover:bg-accent/30 transition-colors shrink-0">
        {memoId.slice(0, 6)}
      </span>
      <span className="truncate">{snippet || <span className="italic opacity-60">No content</span>}</span>
    </Link>
  );
};

export default MemoSnippetLink;
