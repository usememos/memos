import { AlertDialog, Button } from "@usememos/ui";
import * as React from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  confirmVariant?: "primary" | "danger";
}

/** Confirms an action; it closes only through its buttons, and stays open while the action runs. */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmVariant = "primary",
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
    <AlertDialog.Root open={open} onOpenChange={(o: boolean) => !loading && onOpenChange(o)}>
      <AlertDialog.Popup>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        {description ? <AlertDialog.Description>{description}</AlertDialog.Description> : null}
        <AlertDialog.Footer>
          <Button variant="ghost" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={loading} loadingLabel={confirmLabel} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}
