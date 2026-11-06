import { Button, Dialog, Field, Fieldset, Input, Radio, RadioGroup, Textarea } from "@usememos/ui";
import copy from "copy-to-clipboard";
import React, { useEffect, useState } from "react";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { CreatePersonalAccessTokenResponse } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (response: CreatePersonalAccessTokenResponse) => void;
}

interface State {
  description: string;
  expiration: number;
}

function CreateAccessTokenDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslate();
  const fieldErrors = useFieldErrors<"description">();
  const currentUser = useCurrentUser();
  const [state, setState] = useState({
    description: "",
    expiration: 0, // Default: never expires
  });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const requestState = useLoading(false);

  // Expiration options in days (0 = never expires)
  const expirationOptions = [
    {
      label: t("setting.access-token.create-dialog.duration-never"),
      value: 0,
    },
    {
      label: t("setting.access-token.create-dialog.duration-1m"),
      value: 30,
    },
    {
      label: t("setting.access-token.create-dialog.duration-90d"),
      value: 90,
    },
  ];

  const setPartialState = (partialState: Partial<State>) => {
    setState({
      ...state,
      ...partialState,
    });
  };

  const handleDescriptionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    fieldErrors.clear("description");
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
      fieldErrors.set("description", t("message.description-is-required"));
      return;
    }

    try {
      requestState.setLoading();
      const response = await userServiceClient.createPersonalAccessToken({
        parent: currentUser?.name,
        description: state.description,
        expiresInDays: state.expiration,
      });

      requestState.setFinish();
      onSuccess(response);
      if (response.token) {
        setCreatedToken(response.token);
      } else {
        onOpenChange(false);
      }
    } catch (error: unknown) {
      handleError(error, showErrorToast, {
        context: "Create access token",
        onError: () => requestState.setError(),
      });
    }
  };

  const handleCopyToken = () => {
    if (!createdToken) return;
    copy(createdToken);
    toast.add({ title: t("message.copied"), type: "success" });
  };

  useEffect(() => {
    if (!open) return;
    setState({
      description: "",
      expiration: 0,
    });
    setCreatedToken(null);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>{t("setting.access-token.create-dialog.create-access-token")}</Dialog.Title>
        {createdToken ? (
          <div className="flex flex-col gap-4">
            <Field.Root>
              <Field.Label>{t("setting.access-token.token")}</Field.Label>
              <Textarea value={createdToken} readOnly rows={3} className="font-mono" />
            </Field.Root>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field.Root invalid={!!fieldErrors.errors.description}>
              <Field.Label>
                {t("setting.access-token.create-dialog.description")} <span className="text-mu-danger">*</span>
              </Field.Label>
              <Input
                id="description"
                type="text"
                placeholder={t("setting.access-token.create-dialog.some-description")}
                value={state.description}
                onChange={handleDescriptionInputChange}
              />
              {fieldErrors.errors.description && <Field.Error match>{fieldErrors.errors.description}</Field.Error>}
            </Field.Root>
            <Field.Root>
              <Fieldset.Root
                render={<RadioGroup value={state.expiration.toString()} onValueChange={handleRoleInputChange} orientation="horizontal" />}
              >
                <Fieldset.Legend>
                  {t("setting.access-token.create-dialog.expiration")} <span className="text-mu-danger">*</span>
                </Fieldset.Legend>
                {expirationOptions.map((option) => (
                  <Field.Item key={option.value}>
                    <Field.Label>
                      <Radio value={option.value.toString()} /> {option.label}
                    </Field.Label>
                  </Field.Item>
                ))}
              </Fieldset.Root>
            </Field.Root>
          </div>
        )}
        <Dialog.Footer>
          {createdToken ? (
            <>
              <Button variant="ghost" onClick={handleCopyToken}>
                {t("common.copy")}
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
                {t("common.create")}
              </Button>
            </>
          )}
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default CreateAccessTokenDialog;
