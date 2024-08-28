import { Button, IconButton, Input } from "@mui/joy";
import { XIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { webhookServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  webhookId?: number;
  onConfirm: () => void;
}

interface State {
  name: string;
  url: string;
}

const CreateWebhookDialog: React.FC<Props> = (props: Props) => {
  const { webhookId, destroy, onConfirm } = props;
  const t = useTranslate();
  const [state, setState] = useState({
    name: "",
    url: "",
  });
  const requestState = useLoading(false);
  const isCreating = webhookId === undefined;

  useEffect(() => {
    if (webhookId) {
      webhookServiceClient
        .getWebhook({
          id: webhookId,
        })
        .then((webhook) => {
          setState({
            name: webhook.name,
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
      name: e.target.value,
    });
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      url: e.target.value,
    });
  };

  const handleSaveBtnClick = async () => {
    if (!state.name || !state.url) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (isCreating) {
        await webhookServiceClient.createWebhook({
          name: state.name,
          url: state.url,
        });
      } else {
        await webhookServiceClient.updateWebhook({
          webhook: {
            id: webhookId,
            name: state.name,
            url: state.url,
          },
          updateMask: ["name", "url"],
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
    <>
      <div className="dialog-header-container">
        <p className="title-text">{isCreating ? "Create webhook" : "Edit webhook"}</p>
        <IconButton size="sm" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container !w-80">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            Title <span className="text-red-600">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder="An easy-to-remember name"
              value={state.name}
              onChange={handleTitleInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            Payload URL <span className="text-red-600">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder="https://example.com/postreceive"
              value={state.url}
              onChange={handleUrlInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-row justify-end items-center mt-2 space-x-2">
          <Button color="neutral" variant="plain" disabled={requestState.isLoading} loading={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} loading={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </>
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
