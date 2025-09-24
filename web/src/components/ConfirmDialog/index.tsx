import DOMPurify from "dompurify";
import { marked } from "marked";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Open state change callback (closing disabled while loading) */
  onOpenChange: (open: boolean) => void;
  /** Title content (plain text or React nodes) */
  title: React.ReactNode;
  /** Optional description as React nodes (ignored if descriptionMarkdown provided) */
  description?: React.ReactNode;
  /** Optional description in Markdown. Sanitized & rendered as HTML if provided */
  descriptionMarkdown?: string;
  /** Confirm / primary action button label */
  confirmLabel: string;
  /** Cancel button label */
  cancelLabel: string;
  /** Async or sync confirm handler. Dialog auto-closes on resolve, stays open on reject */
  onConfirm: () => void | Promise<void>;
  /** Variant style of confirm button */
  confirmVariant?: "default" | "destructive";
}

/**
 * Accessible confirmation dialog with optional Markdown description.
 * - Renders description from either React nodes or sanitized Markdown
 * - Prevents closing while async confirm action is in-flight
 * - Minimal opinionated styling; leverages existing UI primitives
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  descriptionMarkdown,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmVariant = "default",
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      // Intentionally swallow errors so user can retry; surface via caller's toast/logging
      // TODO: Replace with a proper error reporting service, e.g., Sentry or custom logger
      console.error("ConfirmDialog error:", e);
      // reportError(e);
    } finally {
      setLoading(false);
    }
  };

  // Prepare sanitized HTML if Markdown was provided, memoized for performance
  const descriptionHtml = React.useMemo(() => {
    return typeof descriptionMarkdown === "string" ? DOMPurify.sanitize(String(marked.parse(descriptionMarkdown))) : null;
  }, [descriptionMarkdown]);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !loading && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/* 
            Rendering sanitized Markdown as HTML.
            This is considered safe because DOMPurify removes any potentially dangerous content.
            Ensure that Markdown input is trusted or validated upstream.
          */}
          {descriptionHtml ? (
            <DialogDescription dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
          ) : description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} disabled={loading} onClick={handleConfirm} data-loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
