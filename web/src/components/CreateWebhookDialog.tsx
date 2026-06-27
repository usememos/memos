import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon, EyeIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookName?: string;
  onSuccess?: () => void;
}

interface State {
  displayName: string;
  url: string;
}

function CreateWebhookDialog({ open, onOpenChange, webhookName, onSuccess }: Props) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const isCreating = webhookName === undefined;
  const [state, setState] = useState<State>({ displayName: "", url: "" });
  const requestState = useLoading(false);
  const secretState = useLoading(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | undefined>(undefined);
  const [createdSecret, setCreatedSecret] = useState<string | undefined>(undefined);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (webhookName && currentUser) {
      userServiceClient
        .listUserWebhooks({
          parent: currentUser.name,
        })
        .then((response) => {
          const webhook = response.webhooks.find((w) => w.name === webhookName);
          if (webhook) {
            setState({ displayName: webhook.displayName, url: webhook.url });
            setHasExistingSecret(webhook.signingSecretSet);
          }
        });
    }
  }, [webhookName, currentUser]);

  useEffect(() => {
    if (open && isCreating) {
      setState({ displayName: "", url: "" });
      setHasExistingSecret(false);
      setRevealedSecret(undefined);
      setCreatedSecret(undefined);
      setSecretCopied(false);
    }
  }, [open, isCreating]);

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, displayName: e.target.value }));
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, url: e.target.value }));
  };

  const handleCopySecret = (secret: string) => {
    copy(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleRevealSecret = async () => {
    if (!webhookName) return;
    try {
      secretState.setLoading();
      const { signingSecret } = await userServiceClient.getUserWebhookSigningSecret({ name: webhookName });
      setRevealedSecret(signingSecret);
      secretState.setFinish();
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Reveal signing secret", onError: () => secretState.setError() });
    }
  };

  // Lets a pre-existing webhook that has no secret adopt one. The secret is
  // persisted immediately and revealed so the user can copy it once.
  const handleGenerateSecret = async () => {
    if (!webhookName) return;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = "whsec_" + btoa(String.fromCharCode(...bytes));
    try {
      secretState.setLoading();
      await userServiceClient.updateUserWebhook({
        webhook: { name: webhookName, signingSecret: secret },
        updateMask: create(FieldMaskSchema, { paths: ["signing_secret"] }),
      });
      setHasExistingSecret(true);
      setRevealedSecret(secret);
      handleCopySecret(secret);
      secretState.setFinish();
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Generate signing secret", onError: () => secretState.setError() });
    }
  };

  // When closing after a successful create, refresh the parent list regardless of how the dialog is dismissed.
  const handleOpenChange = (next: boolean) => {
    if (!next && createdSecret !== undefined) {
      onSuccess?.();
    }
    onOpenChange(next);
  };

  const handleSaveBtnClick = async () => {
    if (!state.displayName || !state.url) {
      toast.error(t("message.fill-all-required-fields"));
      return;
    }

    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        // The signing secret is generated server-side; reveal it once so the user can copy it without reopening.
        const created = await userServiceClient.createUserWebhook({
          parent: currentUser.name,
          webhook: { displayName: state.displayName, url: state.url },
        });
        let secret: string | undefined;
        try {
          const response = await userServiceClient.getUserWebhookSigningSecret({ name: created.name });
          secret = response.signingSecret;
        } catch {
          // Reveal failed — the secret is still set and can be revealed later from the edit dialog.
        }
        requestState.setFinish();
        if (secret !== undefined) {
          setCreatedSecret(secret);
          return;
        }
        onSuccess?.();
        onOpenChange(false);
        return;
      }

      await userServiceClient.updateUserWebhook({
        webhook: { name: webhookName, displayName: state.displayName, url: state.url },
        updateMask: create(FieldMaskSchema, { paths: ["display_name", "url"] }),
      });
      onSuccess?.();
      onOpenChange(false);
      requestState.setFinish();
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: webhookName ? "Update webhook" : "Create webhook",
        onError: () => requestState.setError(),
      });
    }
  };

  const renderSecretField = (secret: string) => (
    <div className="flex items-center gap-2">
      <Input readOnly type="text" value={secret} className="flex-1 font-mono text-xs" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => handleCopySecret(secret)}
        aria-label={t("setting.webhook.create-dialog.copy-secret")}
      >
        {secretCopied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon className="h-4 w-4" />}
      </Button>
    </div>
  );

  const renderSigningSecret = () => {
    if (isCreating) {
      return <span className="text-xs text-muted-foreground">{t("setting.webhook.create-dialog.signing-secret-auto-note")}</span>;
    }
    if (revealedSecret !== undefined) {
      return renderSecretField(revealedSecret);
    }
    if (hasExistingSecret) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">{t("setting.webhook.create-dialog.signing-secret-configured")}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleRevealSecret} disabled={secretState.isLoading}>
            <EyeIcon className="mr-1 h-3.5 w-3.5" />
            {t("setting.webhook.create-dialog.reveal-secret")}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-muted-foreground">{t("setting.webhook.create-dialog.signing-secret-not-configured")}</span>
        <Button type="button" variant="outline" size="sm" onClick={handleGenerateSecret} disabled={secretState.isLoading}>
          {t("setting.webhook.create-dialog.generate-secret")}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? t("setting.webhook.create-dialog.create-webhook") : t("setting.webhook.create-dialog.edit-webhook")}
          </DialogTitle>
        </DialogHeader>
        {createdSecret !== undefined ? (
          <div className="grid gap-2">
            <Label>{t("setting.webhook.create-dialog.signing-secret")}</Label>
            <span className="text-xs text-muted-foreground">{t("setting.webhook.create-dialog.signing-secret-created-note")}</span>
            {renderSecretField(createdSecret)}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">
                {t("setting.webhook.create-dialog.title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder={t("setting.webhook.create-dialog.an-easy-to-remember-name")}
                value={state.displayName}
                onChange={handleTitleInputChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">
                {t("setting.webhook.create-dialog.payload-url")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="url"
                type="text"
                placeholder={t("setting.webhook.create-dialog.url-example-post-receive")}
                value={state.url}
                onChange={handleUrlInputChange}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("setting.webhook.create-dialog.signing-secret")}</Label>
              {renderSigningSecret()}
            </div>
          </div>
        )}
        <DialogFooter>
          {createdSecret !== undefined ? (
            <Button onClick={() => handleOpenChange(false)}>{t("common.close")}</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
                {isCreating ? t("common.create") : t("common.save")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWebhookDialog;
