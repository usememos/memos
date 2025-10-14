import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { UserAccessToken } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created: UserAccessToken) => void;
}

interface State {
  description: string;
  expiration: number;
}

function CreateAccessTokenDialog({ open, onOpenChange, onSuccess }: Props) {
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
      requestState.setLoading();
      const created = await userServiceClient.createUserAccessToken({
        parent: currentUser.name,
        accessToken: {
          description: state.description,
          expiresAt: state.expiration ? new Date(Date.now() + state.expiration * 1000) : undefined,
        },
      });

      requestState.setFinish();
      onSuccess(created);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
      requestState.setError();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("setting.access-token-section.create-dialog.create-access-token")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="description">
              {t("setting.access-token-section.create-dialog.description")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="description"
              type="text"
              placeholder={t("setting.access-token-section.create-dialog.some-description")}
              value={state.description}
              onChange={handleDescriptionInputChange}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              {t("setting.access-token-section.create-dialog.expiration")} <span className="text-destructive">*</span>
            </Label>
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

export default CreateAccessTokenDialog;
