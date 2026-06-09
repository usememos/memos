import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon, Trash2Icon } from "lucide-react";
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
  signingSecret: string | undefined;
}

function CreateWebhookDialog({ open, onOpenChange, webhookName, onSuccess }: Props) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const isCreating = webhookName === undefined;
  const [state, setState] = useState<State>({
    displayName: "",
    url: "",
    signingSecret: isCreating ? "" : undefined,
  });
  const requestState = useLoading(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
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
            setState({
              displayName: webhook.displayName,
              url: webhook.url,
              signingSecret: undefined,
            });
            setHasExistingSecret(webhook.hasSigningSecret);
          }
        });
    }
  }, [webhookName, currentUser]);

  useEffect(() => {
    if (open && isCreating) {
      setState({
        displayName: "",
        url: "",
        signingSecret: "",
      });
      setHasExistingSecret(false);
      setSecretCopied(false);
    }
  }, [open, isCreating]);

  const setPartialState = (partialState: Partial<State>) => {
    setState({
      ...state,
      ...partialState,
    });
  };

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      displayName: e.target.value,
    });
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      url: e.target.value,
    });
  };

  const handleGenerateAndCopy = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = "whsec_" + btoa(String.fromCharCode(...bytes));
    setPartialState({ signingSecret: secret });
    copy(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleClearSecret = () => {
    setPartialState({ signingSecret: "" });
  };

  const normalizedSigningSecret = state.signingSecret?.trim() ?? "";

  const getPendingLabel = () => {
    const prefix = `${t("setting.webhook.create-dialog.signing-secret-pending")}: `;
    if (state.signingSecret === undefined) {
      return prefix + t("setting.webhook.create-dialog.signing-secret-pending-no-changes");
    }
    if (state.signingSecret === "") {
      if (isCreating) {
        return prefix + t("setting.webhook.create-dialog.signing-secret-pending-no-changes");
      }
      return prefix + t("setting.webhook.create-dialog.signing-secret-pending-cleared");
    }
    return prefix + t("setting.webhook.create-dialog.signing-secret-pending-generated");
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
        await userServiceClient.createUserWebhook({
          parent: currentUser.name,
          webhook: {
            displayName: state.displayName,
            url: state.url,
            signingSecret: normalizedSigningSecret,
          },
        });
      } else {
        const updateMaskPaths = ["display_name", "url"];
        if (state.signingSecret !== undefined) {
          updateMaskPaths.push("signing_secret");
        }
        await userServiceClient.updateUserWebhook({
          webhook: {
            name: webhookName,
            displayName: state.displayName,
            url: state.url,
            ...(state.signingSecret !== undefined && { signingSecret: normalizedSigningSecret }),
          },
          updateMask: create(FieldMaskSchema, { paths: updateMaskPaths }),
        });
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? t("setting.webhook.create-dialog.create-webhook") : t("setting.webhook.create-dialog.edit-webhook")}
          </DialogTitle>
        </DialogHeader>
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
            <div className="flex items-center gap-2">
              <Label>{t("setting.webhook.create-dialog.signing-secret")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("setting.webhook.create-dialog.signing-secret-status")}:{" "}
                {hasExistingSecret
                  ? t("setting.webhook.create-dialog.signing-secret-configured")
                  : t("setting.webhook.create-dialog.signing-secret-not-configured")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAndCopy}
                aria-label={t("setting.webhook.create-dialog.generate-and-copy-secret")}
              >
                {secretCopied ? (
                  <>
                    <CheckIcon className="mr-1 h-3.5 w-3.5 text-success" />
                    {t("setting.webhook.create-dialog.copied")}
                  </>
                ) : (
                  <>
                    <CopyIcon className="mr-1 h-3.5 w-3.5" />
                    {t("setting.webhook.create-dialog.generate-and-copy-secret")}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSecret}
                disabled={!state.signingSecret && !hasExistingSecret}
                aria-label={t("setting.webhook.create-dialog.clear-secret")}
              >
                <Trash2Icon className="mr-1 h-3.5 w-3.5" />
                {t("setting.webhook.create-dialog.clear-secret")}
              </Button>
              <span className="text-xs text-muted-foreground">{getPendingLabel()}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {isCreating ? t("common.create") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWebhookDialog;
