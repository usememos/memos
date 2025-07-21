import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { userServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: () => void;
}

function CreateUserDialog({ open, onOpenChange, user: initialUser, onSuccess }: Props) {
  const t = useTranslate();
  const [user, setUser] = useState(User.fromPartial({ ...initialUser }));
  const requestState = useLoading(false);
  const isCreating = !initialUser;

  useEffect(() => {
    if (initialUser) {
      setUser(User.fromPartial(initialUser));
    } else {
      setUser(User.fromPartial({}));
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
      toast.error("Username and password cannot be empty");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await userServiceClient.createUser({ user });
        toast.success("Create user successfully");
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
        await userServiceClient.updateUser({ user, updateMask });
        toast.success("Update user successfully");
      }
      requestState.setFinish();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
      requestState.setError();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.user")}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">{t("common.username")}</Label>
            <Input
              id="username"
              type="text"
              placeholder={t("common.username")}
              value={user.username}
              onChange={(e) =>
                setPartialUser({
                  username: e.target.value,
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("common.password")}
              autoComplete="off"
              value={user.password}
              onChange={(e) =>
                setPartialUser({
                  password: e.target.value,
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("common.role")}</Label>
            <RadioGroup
              value={user.role}
              onValueChange={(value) => setPartialUser({ role: value as User_Role })}
              className="flex flex-row gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={User_Role.USER} id="user" />
                <Label htmlFor="user">{t("setting.member-section.user")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={User_Role.ADMIN} id="admin" />
                <Label htmlFor="admin">{t("setting.member-section.admin")}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateUserDialog;
