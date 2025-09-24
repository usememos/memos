import DOMPurify from "dompurify";
import { marked } from "marked";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  descriptionMarkdown?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  confirmVariant?: "default" | "destructive";
}

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
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // prepare sanitized HTML if Markdown was provided
  const descriptionHtml = typeof descriptionMarkdown === "string" ? DOMPurify.sanitize(String(marked.parse(descriptionMarkdown))) : null;

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !loading && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
          <Button variant={confirmVariant} disabled={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
