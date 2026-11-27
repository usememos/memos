import { Code } from "@connectrpc/connect";
import { Button } from "@usememos/ui";
import { useState } from "react";
import { getErrorMessage, hasConnectCode } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";

interface Props {
  error: unknown;
  onRetry: () => Promise<unknown>;
  /** Present when the failing list carries a user query that can be edited or cleared. */
  onEditQuery?: () => void;
  onClearQuery?: () => void;
}

const MESSAGE_KEYS = {
  invalid: "search.invalid-expression",
  denied: "search.access-error",
  load: "search.load-error",
} as const;

const classify = (error: unknown): keyof typeof MESSAGE_KEYS => {
  if (hasConnectCode(error, Code.InvalidArgument)) return "invalid";
  if (hasConnectCode(error, Code.PermissionDenied, Code.Unauthenticated)) return "denied";
  return "load";
};

const MemoListError = ({ error, onRetry, onEditQuery, onClearQuery }: Props) => {
  const t = useTranslate();
  const [retrying, setRetrying] = useState(false);
  const kind = classify(error);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div role="alert" className="w-full min-w-0 space-y-3 rounded-mu-lg border border-mu-line px-4 py-4">
      <p className="mu-label">{t(MESSAGE_KEYS[kind])}</p>
      {kind === "invalid" && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono mu-caption text-mu-text-secondary">
          {getErrorMessage(error)}
        </pre>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {kind === "load" && (
          <Button variant="neutral" size="sm" disabled={retrying} onClick={handleRetry}>
            {t("search.retry")}
          </Button>
        )}
        {kind !== "load" && onEditQuery && (
          <Button variant="neutral" size="sm" onClick={onEditQuery}>
            {t("search.edit-query")}
          </Button>
        )}
        {kind !== "load" && onClearQuery && (
          <Button variant="ghost" size="sm" onClick={onClearQuery}>
            {t("search.clear-query")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MemoListError;
