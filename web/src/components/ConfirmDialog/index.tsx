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
  /** Optional description (plain text or React nodes) */
  description?: React.ReactNode;
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
 * Accessible confirmation dialog.
 * - Renders optional description content
 * - Prevents closing while async confirm action is in-flight
 * - Minimal opinionated styling; leverages existing UI primitives
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
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
      console.error("ConfirmDialog error for action:", title, e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !loading && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
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
