import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon } from "lucide-react";
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

  const handleSigningSecretInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      signingSecret: e.target.value,
    });
  };

  const handleGenerateSecret = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = "whsec_" + btoa(String.fromCharCode(...bytes));
    setPartialState({ signingSecret: secret });
    setSecretCopied(false);
  };

  const handleCopySecret = () => {
    if (!state.signingSecret) return;
    copy(state.signingSecret.trim());
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const normalizedSigningSecret = state.signingSecret?.trim() ?? "";

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
            <Label htmlFor="signingSecret">{t("setting.webhook.create-dialog.signing-secret")}</Label>
            <span className="text-xs text-muted-foreground">{t("setting.webhook.create-dialog.signing-secret-description")}</span>
            <div className="flex gap-2">
              <Input
                id="signingSecret"
                type="password"
                placeholder={t("setting.webhook.create-dialog.signing-secret-placeholder")}
                value={state.signingSecret ?? ""}
                onChange={handleSigningSecretInputChange}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopySecret}
                disabled={!state.signingSecret}
                aria-label={t("setting.webhook.create-dialog.copy-secret")}
              >
                {secretCopied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" onClick={handleGenerateSecret}>
                {t("setting.webhook.create-dialog.generate-secret")}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWebhookDialog;
