import { Radio, RadioGroup } from "@mui/joy";
import { Button, Input } from "@usememos/mui";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  user?: User;
  confirmCallback?: () => void;
}

const CreateUserDialog: React.FC<Props> = (props: Props) => {
  const { confirmCallback, destroy } = props;
  const t = useTranslate();
  const [user, setUser] = useState(User.fromPartial({ ...props.user }));
  const requestState = useLoading(false);
  const isCreating = !props.user;

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
      if (isCreating) {
        await userServiceClient.createUser({ user });
        toast.success("Create user successfully");
      } else {
        const updateMask = [];
        if (user.username !== props.user?.username) {
          updateMask.push("username");
        }
        if (user.password) {
          updateMask.push("password");
        }
        if (user.role !== props.user?.role) {
          updateMask.push("role");
        }
        await userServiceClient.updateUser({ user, updateMask });
        toast.success("Update user successfully");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
    if (confirmCallback) {
      confirmCallback();
    }
    destroy();
  };

  return (
    <div className="max-w-full shadow flex flex-col justify-start items-start bg-white dark:bg-zinc-800 dark:text-gray-300 p-4 rounded-lg">
      <div className="flex flex-row justify-between items-center mb-4 gap-2 w-full">
        <p className="title-text">{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.user")}`}</p>
        <Button variant="plain" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-md min-w-72">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="text-sm whitespace-nowrap mb-1">{t("common.username")}</span>
          <Input
            className="w-full"
            type="text"
            placeholder={t("common.username")}
            value={user.username}
            onChange={(e) =>
              setPartialUser({
                username: e.target.value,
              })
            }
          />
          <span className="text-sm whitespace-nowrap mt-3 mb-1">{t("common.password")}</span>
          <Input
            className="w-full"
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
          <span className="text-sm whitespace-nowrap mt-3 mb-1">{t("common.role")}</span>
          <RadioGroup
            orientation="horizontal"
            defaultValue={user.role}
            onChange={(e) => setPartialUser({ role: e.target.value as User_Role })}
          >
            <Radio value={User_Role.USER} label={t("setting.member-section.user")} />
            <Radio value={User_Role.ADMIN} label={t("setting.member-section.admin")} />
          </RadioGroup>
        </div>
        <div className="w-full flex flex-row justify-end items-center space-x-2 mt-2">
          <Button variant="plain" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};

function showCreateUserDialog(user?: User, confirmCallback?: () => void) {
  generateDialog(
    {
      className: "create-user-dialog",
      dialogName: "create-user-dialog",
    },
    CreateUserDialog,
    { user, confirmCallback },
  );
}

export default showCreateUserDialog;
