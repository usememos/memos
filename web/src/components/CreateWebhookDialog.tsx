import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { Button, Dialog, Field, Input, Tooltip } from "@usememos/ui";
import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon, EyeIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { showErrorToast } from "@/lib/toast";
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
  const fieldErrors = useFieldErrors<"displayName" | "url">();
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
    fieldErrors.clear("displayName");
    setState((prev) => ({ ...prev, displayName: e.target.value }));
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    fieldErrors.clear("url");
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
      handleError(error, showErrorToast, { context: "Reveal signing secret", onError: () => secretState.setError() });
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
      handleError(error, showErrorToast, { context: "Generate signing secret", onError: () => secretState.setError() });
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
      fieldErrors.set(!state.displayName ? "displayName" : "url", t("message.fill-all-required-fields"));
      return;
    }

    if (!currentUser) {
      showErrorToast(t("message.not-signed-in"));
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
      handleError(error, showErrorToast, {
        context: webhookName ? "Update webhook" : "Create webhook",
        onError: () => requestState.setError(),
      });
    }
  };

  const renderSecretField = (secret: string) => (
    <div className="flex items-center gap-2">
      <Input readOnly type="text" value={secret} className="flex-1 font-mono" />
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button
              type="button"
              variant="neutral"
              onClick={() => handleCopySecret(secret)}
              aria-label={t("setting.webhook.create-dialog.copy-secret")}
              icon={secretCopied ? <CheckIcon /> : <CopyIcon />}
            />
          }
        />
        <Tooltip.Popup>{t("setting.webhook.create-dialog.copy-secret")}</Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );

  const renderSigningSecret = () => {
    if (isCreating) {
      return <Field.Description>{t("setting.webhook.create-dialog.signing-secret-auto-note")}</Field.Description>;
    }
    if (revealedSecret !== undefined) {
      return renderSecretField(revealedSecret);
    }
    if (hasExistingSecret) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex-1 mu-caption text-mu-ink-muted">{t("setting.webhook.create-dialog.signing-secret-configured")}</span>
          <Button
            type="button"
            variant="neutral"
            size="sm"
            onClick={handleRevealSecret}
            disabled={secretState.isLoading}
            icon={<EyeIcon />}
          >
            {t("setting.webhook.create-dialog.reveal-secret")}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 mu-caption text-mu-ink-muted">{t("setting.webhook.create-dialog.signing-secret-not-configured")}</span>
        <Button type="button" variant="neutral" onClick={handleGenerateSecret} disabled={secretState.isLoading}>
          {t("setting.webhook.create-dialog.generate-secret")}
        </Button>
      </div>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>
          {isCreating ? t("setting.webhook.create-dialog.create-webhook") : t("setting.webhook.create-dialog.edit-webhook")}
        </Dialog.Title>
        {createdSecret !== undefined ? (
          <Field.Root>
            <Field.Label>{t("setting.webhook.create-dialog.signing-secret")}</Field.Label>
            <Field.Description>{t("setting.webhook.create-dialog.signing-secret-created-note")}</Field.Description>
            {renderSecretField(createdSecret)}
          </Field.Root>
        ) : (
          <div className="flex flex-col gap-4">
            <Field.Root invalid={!!fieldErrors.errors.displayName}>
              <Field.Label>
                {t("setting.webhook.create-dialog.title")} <span className="text-mu-danger">*</span>
              </Field.Label>
              <Input
                id="displayName"
                type="text"
                placeholder={t("setting.webhook.create-dialog.an-easy-to-remember-name")}
                value={state.displayName}
                onChange={handleTitleInputChange}
              />
              {fieldErrors.errors.displayName && <Field.Error match>{fieldErrors.errors.displayName}</Field.Error>}
            </Field.Root>
            <Field.Root invalid={!!fieldErrors.errors.url}>
              <Field.Label>
                {t("setting.webhook.create-dialog.payload-url")} <span className="text-mu-danger">*</span>
              </Field.Label>
              <Input
                id="url"
                type="text"
                placeholder={t("setting.webhook.create-dialog.url-example-post-receive")}
                value={state.url}
                onChange={handleUrlInputChange}
              />
              {fieldErrors.errors.url && <Field.Error match>{fieldErrors.errors.url}</Field.Error>}
            </Field.Root>
            <Field.Root>
              <Field.Label>{t("setting.webhook.create-dialog.signing-secret")}</Field.Label>
              {renderSigningSecret()}
            </Field.Root>
          </div>
        )}
        <Dialog.Footer>
          {createdSecret !== undefined ? (
            <Button variant="primary" onClick={() => handleOpenChange(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
                {isCreating ? t("common.create") : t("common.save")}
              </Button>
            </>
          )}
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default CreateWebhookDialog;
