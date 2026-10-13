import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslate } from "@/utils/i18n";

interface ExternalLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
}

/** Collects a target for an external Markdown link without affecting memo relations. */
export function ExternalLinkDialog({ open, onOpenChange, onConfirm }: ExternalLinkDialogProps) {
  const t = useTranslate();
  const [url, setURL] = useState("");

  useEffect(() => {
    if (!open) setURL("");
  }, [open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = url.trim();
    if (!target) return;
    onConfirm(target);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("editor.format.link")}</DialogTitle>
            <DialogDescription>{t("editor.format.link")}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label={t("editor.format.link")}
            autoFocus
            onChange={(event) => setURL(event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={url}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.confirm")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
