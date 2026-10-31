import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  action?: string;
  onAction?: () => void;
}

/**
 * An empty list's one line: a muted sentence and, when there is somewhere to go from here,
 * one quiet action beside it. First use and no results each get their own line so an
 * empty timeline never reads as a failed search.
 */
const EmptyLine = ({ message, action, onAction }: Props) => (
  <div className="flex w-full flex-wrap items-center justify-center gap-x-1 py-10 text-sm text-muted-foreground">
    <span>{message}</span>
    {action && onAction && (
      <>
        <span aria-hidden="true">·</span>
        <Button variant="link" size="sm" onClick={onAction}>
          {action}
        </Button>
      </>
    )}
  </div>
);

export default EmptyLine;
