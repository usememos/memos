import { XIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { webhookServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  webhookName?: string;
  onConfirm: () => void;
}

interface State {
  displayName: string;
  url: string;
}

const CreateWebhookDialog: React.FC<Props> = (props: Props) => {
  const { webhookName, destroy, onConfirm } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [state, setState] = useState({
    displayName: "",
    url: "",
  });
  const requestState = useLoading(false);
  const isCreating = webhookName === undefined;

  useEffect(() => {
    if (webhookName) {
      webhookServiceClient
        .getWebhook({
          name: webhookName,
        })
        .then((webhook) => {
          setState({
            displayName: webhook.displayName,
            url: webhook.url,
          });
        });
    }
  }, []);

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
      if (isCreating) {
        await webhookServiceClient.createWebhook({
          parent: currentUser.name,
          webhook: {
            displayName: state.displayName,
            url: state.url,
          },
        });
      } else {
        await webhookServiceClient.updateWebhook({
          webhook: {
            name: webhookName,
            displayName: state.displayName,
            url: state.url,
          },
          updateMask: ["display_name", "url"],
        });
      }

      onConfirm();
      destroy();
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  return (
    <div className="max-w-full shadow flex flex-col justify-start items-start bg-white dark:bg-zinc-800 dark:text-gray-300 p-4 rounded-lg">
      <div className="flex flex-row justify-between items-center mb-4 gap-2 w-full">
        <p className="title-text">
          {isCreating ? t("setting.webhook-section.create-dialog.create-webhook") : t("setting.webhook-section.create-dialog.edit-webhook")}
        </p>
        <Button variant="ghost" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="flex flex-col justify-start items-start w-80!">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            {t("setting.webhook-section.create-dialog.title")} <span className="text-red-600">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder={t("setting.webhook-section.create-dialog.an-easy-to-remember-name")}
              value={state.displayName}
              onChange={handleTitleInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            {t("setting.webhook-section.create-dialog.payload-url")} <span className="text-red-600">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder={t("setting.webhook-section.create-dialog.url-example-post-receive")}
              value={state.url}
              onChange={handleUrlInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-row justify-end items-center mt-2 space-x-2">
          <Button variant="ghost" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
};

function showCreateWebhookDialog(onConfirm: () => void) {
  generateDialog(
    {
      className: "create-webhook-dialog",
      dialogName: "create-webhook-dialog",
    },
    CreateWebhookDialog,
    {
      onConfirm,
    },
  );
}

export default showCreateWebhookDialog;
