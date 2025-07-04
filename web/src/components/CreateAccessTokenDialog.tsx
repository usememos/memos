import { XIcon } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  onConfirm: () => void;
}

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

  const expirationOptions = [
    {
      label: t("setting.access-token-section.create-dialog.duration-8h"),
      value: 3600 * 8,
    },
    {
      label: t("setting.access-token-section.create-dialog.duration-1m"),
      value: 3600 * 24 * 30,
    },
    {
      label: t("setting.access-token-section.create-dialog.duration-never"),
      value: 0,
    },
  ];

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

  const handleRoleInputChange = (value: string) => {
    setPartialState({
      expiration: Number(value),
    });
  };

  const handleSaveBtnClick = async () => {
    if (!state.description) {
      toast.error(t("message.description-is-required"));
      return;
    }

    try {
      await userServiceClient.createUserAccessToken({
        parent: currentUser.name,
        accessToken: {
          description: state.description,
          expiresAt: state.expiration ? new Date(Date.now() + state.expiration * 1000) : undefined,
        },
      });

      onConfirm();
      destroy();
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
  };

  return (
    <div className="max-w-full shadow flex flex-col justify-start items-start bg-card text-card-foreground p-4 rounded-lg">
      <div className="flex flex-row justify-between items-center w-full mb-4 gap-2">
        <p>{t("setting.access-token-section.create-dialog.create-access-token")}</p>
        <Button variant="ghost" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="flex flex-col justify-start items-start w-80!">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            {t("setting.access-token-section.create-dialog.description")} <span className="text-destructive">*</span>
          </span>
          <div className="relative w-full">
            <Input
              className="w-full"
              type="text"
              placeholder={t("setting.access-token-section.create-dialog.some-description")}
              value={state.description}
              onChange={handleDescriptionInputChange}
            />
          </div>
        </div>
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="mb-2">
            {t("setting.access-token-section.create-dialog.expiration")} <span className="text-destructive">*</span>
          </span>
          <div className="w-full flex flex-row justify-start items-center text-base">
            <RadioGroup value={state.expiration.toString()} onValueChange={handleRoleInputChange} className="flex flex-row gap-4">
              {expirationOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value.toString()} id={`expiration-${option.value}`} />
                  <Label htmlFor={`expiration-${option.value}`}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
        <div className="w-full flex flex-row justify-end items-center mt-4 space-x-2">
          <Button variant="ghost" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </div>
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
