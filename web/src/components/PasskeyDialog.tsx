import { LoaderIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleError } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";
import { createPasskey, deletePasskey, getPasskeyErrorKey, listPasskeys, type Passkey, supportsPasskeys } from "@/utils/passkey";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PasskeyDialog({ open, onOpenChange }: Props) {
  const t = useTranslate();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPasskey, setDeletingPasskey] = useState<Passkey | undefined>(undefined);

  const loadPasskeys = async () => {
    setIsLoading(true);
    try {
      const passkeys = await listPasskeys();
      setPasskeys(passkeys);
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "List passkeys",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPasskeys();
  }, [open]);

  const handleCreatePasskey = async () => {
    if (isCreating) {
      return;
    }

    try {
      setIsCreating(true);
      await createPasskey();
      toast.success(t("message.passkey-created"));
      await loadPasskeys();
    } catch (error: unknown) {
      const errorKey = getPasskeyErrorKey(error, "create");
      if (errorKey) {
        console.error(error);
        toast.error(t(errorKey));
        return;
      }
      await handleError(error, toast.error, {
        fallbackMessage: "Failed to create passkey.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatUnixTime = (value?: number) => {
    if (!value) {
      return t("setting.account.passkey-never-used");
    }
    return new Date(value * 1000).toLocaleString();
  };

  const confirmDeletePasskey = async () => {
    if (!deletingPasskey) {
      return;
    }

    try {
      await deletePasskey(deletingPasskey.id);
      setPasskeys((prev) => prev.filter((passkey) => passkey.id !== deletingPasskey.id));
      toast.success(t("message.passkey-deleted"));
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Delete passkey",
      });
      throw error;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("setting.account.passkey-title")}</DialogTitle>
            <DialogDescription>{t("setting.account.passkey-dialog-description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("setting.account.passkey-list-title")}</p>
                <p className="text-sm text-muted-foreground">
                  {supportsPasskeys() ? t("setting.account.passkey-description") : t("auth.passkey-unsupported")}
                </p>
              </div>
              <Button size="sm" onClick={handleCreatePasskey} disabled={isCreating || !supportsPasskeys()}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                {t("common.add")}
                {isCreating && <LoaderIcon className="ml-2 h-4 w-4 animate-spin opacity-60" />}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin opacity-60" />
                  {t("setting.account.passkey-loading")}
                </div>
              ) : passkeys.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("setting.account.no-passkeys-found")}
                </div>
              ) : (
                passkeys.map((passkey) => (
                  <div key={passkey.id} className="rounded-lg border border-border/70 bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{passkey.label}</p>
                        {passkey.transports && passkey.transports.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">{passkey.transports.join(", ")}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingPasskey(passkey)}>
                        <TrashIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                      <p>
                        {t("setting.account.passkey-added-at")}: {formatUnixTime(passkey.addedTs)}
                      </p>
                      <p>
                        {t("setting.account.passkey-last-used-at")}: {formatUnixTime(passkey.lastUsedTs)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingPasskey}
        onOpenChange={(open) => !open && setDeletingPasskey(undefined)}
        title={deletingPasskey ? t("setting.account.passkey-deletion", { label: deletingPasskey.label }) : ""}
        description={t("setting.account.passkey-deletion-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeletePasskey}
        confirmVariant="destructive"
      />
    </>
  );
}

export default PasskeyDialog;
