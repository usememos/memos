import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { Button, Dialog, Field, Fieldset, Input, Radio, RadioGroup } from "@usememos/ui";
import { useEffect, useState } from "react";
import { userServiceClient } from "@/connect";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { User, User_Role, UserSchema } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import ManagedByConfigurationChip from "./Settings/ManagedByConfigurationChip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: () => void;
}

function CreateUserDialog({ open, onOpenChange, user: initialUser, onSuccess }: Props) {
  const t = useTranslate();
  const fieldErrors = useFieldErrors<"username" | "password">();
  const [user, setUser] = useState(
    create(UserSchema, initialUser ? { name: initialUser.name, username: initialUser.username, role: initialUser.role } : {}),
  );
  const requestState = useLoading(false);
  const isCreating = !initialUser;
  // The password is write-only, so configuration never locks it.
  const managed = useManagedResource(initialUser?.name ?? "");

  useEffect(() => {
    if (initialUser) {
      setUser(create(UserSchema, { name: initialUser.name, username: initialUser.username, role: initialUser.role }));
    } else {
      setUser(create(UserSchema, {}));
    }
  }, [initialUser]);

  const setPartialUser = (state: Partial<User>) => {
    setUser({
      ...user,
      ...state,
    });
  };

  const handleConfirm = async () => {
    if (isCreating && (!user.username || !user.password)) {
      fieldErrors.set(!user.username ? "username" : "password", t("setting.member.username-password-required"));
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await userServiceClient.createUser({ user });
        toast.add({ title: t("setting.member.create-success"), type: "success" });
      } else {
        const updateMask = [];
        if (user.username !== initialUser?.username) {
          updateMask.push("username");
        }
        if (user.password) {
          updateMask.push("password");
        }
        if (user.role !== initialUser?.role) {
          updateMask.push("role");
        }
        const userToUpdate = create(UserSchema, { ...user, name: initialUser?.name ?? user.name });
        await userServiceClient.updateUser({ user: userToUpdate, updateMask: create(FieldMaskSchema, { paths: updateMask }) });
        toast.add({ title: t("setting.member.update-success"), type: "success" });
      }
      requestState.setFinish();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      handleError(error, showErrorToast, {
        context: isCreating ? "Create user" : "Update user",
        onError: () => requestState.setError(),
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.user")}`}</Dialog.Title>
        {managed ? (
          <div className="flex">
            <ManagedByConfigurationChip resource={managed} />
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <Field.Root invalid={!!fieldErrors.errors.username}>
            <Field.Label>{t("common.username")}</Field.Label>
            <Input
              id="username"
              type="text"
              placeholder={t("common.username")}
              disabled={isFieldManaged(managed, "username")}
              value={user.username}
              onChange={(e) => (
                fieldErrors.clear("username"),
                setPartialUser({
                  username: e.target.value,
                })
              )}
            />
            {fieldErrors.errors.username && <Field.Error match>{fieldErrors.errors.username}</Field.Error>}
          </Field.Root>
          <Field.Root invalid={!!fieldErrors.errors.password}>
            <Field.Label>{t("common.password")}</Field.Label>
            <Input
              id="password"
              type="password"
              placeholder={t("common.password")}
              autoComplete="off"
              value={user.password}
              onChange={(e) => (
                fieldErrors.clear("password"),
                setPartialUser({
                  password: e.target.value,
                })
              )}
            />
            {fieldErrors.errors.password && <Field.Error match>{fieldErrors.errors.password}</Field.Error>}
          </Field.Root>
          <Field.Root>
            <Fieldset.Root
              render={
                <RadioGroup
                  disabled={isFieldManaged(managed, "role")}
                  value={String(user.role)}
                  onValueChange={(value) => setPartialUser({ role: Number(value) as User_Role })}
                  orientation="horizontal"
                />
              }
            >
              <Fieldset.Legend>{t("common.role")}</Fieldset.Legend>
              <Field.Item>
                <Field.Label>
                  <Radio value={String(User_Role.USER)} /> {t("setting.member.user")}
                </Field.Label>
              </Field.Item>
              <Field.Item>
                <Field.Label>
                  <Radio value={String(User_Role.ADMIN)} /> {t("setting.member.admin")}
                </Field.Label>
              </Field.Item>
            </Fieldset.Root>
          </Field.Root>
        </div>
        <Dialog.Footer>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default CreateUserDialog;
