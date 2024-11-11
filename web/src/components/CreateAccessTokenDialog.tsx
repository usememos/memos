import { Radio, RadioGroup } from "@mui/joy";
import { Button, Input } from "@usememos/mui";
import { XIcon } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  onConfirm: () => void;
}

const expirationOptions = [
  {
    label: "8 hours",
    value: 3600 * 8,
  },
  {
    label: "1 month",
    value: 3600 * 24 * 30,
  },
  {
    label: "Never",
    value: 0,
  },
];

interface State {
  description: string;
  expiration: number;
}

const CreateAccessTokenDialog: React.FC<Props> = (props: Props) => {
  const { destroy, onConfirm } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [state, setState] = useState({
    description: "",
    expiration: 3600 * 8,
  });
  const requestState = useLoading(false);

  const setPartialState = (partialState: Partial<State>) => {
    setState({
      ...state,
      ...partialState,
    });
  };

  const handleDescriptionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      description: e.target.value,
    });
  };

  const handleRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      expiration: Number(e.target.value),
    });
  };

  const handleSaveBtnClick = async () => {
    if (!state.description) {
      toast.error("Description is required");
      return;
    }

    try {
      await userServiceClient.createUserAccessToken({
        name: currentUser.name,
        description: state.description,
        expiresAt: state.expiration ? new Date(Date.now() + state.expiration * 1000) : undefined,
      });

      onConfirm();
      destroy();
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Create access token</p>
        <Button size="sm" variant="plain" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="dialog-content-container !w-80">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            Description <span className="text-red-600">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder="Some description"
              value={state.description}
              onChange={handleDescriptionInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            Expiration <span className="text-red-600">*</span>
          </span>
          <div className="w-full flex flex-row justify-start items-center text-base">
            <RadioGroup orientation="horizontal" value={state.expiration} onChange={handleRoleInputChange}>
              {expirationOptions.map((option) => (
                <Radio key={option.value} value={option.value} checked={state.expiration === option.value} label={option.label} />
              ))}
            </RadioGroup>
          </div>
        </div>
        <div className="w-full flex flex-row justify-end items-center mt-4 space-x-2">
          <Button variant="plain" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateAccessTokenDialog(onConfirm: () => void) {
  generateDialog(
    {
      className: "create-access-token-dialog",
      dialogName: "create-access-token-dialog",
    },
    CreateAccessTokenDialog,
    {
      onConfirm,
    },
  );
}

export default showCreateAccessTokenDialog;
