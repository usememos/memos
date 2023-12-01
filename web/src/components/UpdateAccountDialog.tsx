import { isEqual } from "lodash-es";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { convertFileToBase64 } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserNamePrefix, useUserV1Store } from "@/store/v1";
import { User as UserPb } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";

type Props = DialogProps;

interface State {
  avatarUrl: string;
  username: string;
  nickname: string;
  email: string;
}

const UpdateAccountDialog: React.FC<Props> = ({ destroy }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const userV1Store = useUserV1Store();
  const [state, setState] = useState<State>({
    avatarUrl: currentUser.avatarUrl,
    username: currentUser.name.replace(UserNamePrefix, ""),
    nickname: currentUser.nickname,
    email: currentUser.email,
  });

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const setPartialState = (partialState: Partial<State>) => {
    setState((state) => {
      return {
        ...state,
        ...partialState,
      };
    });
  };

  const handleAvatarChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const image = files[0];
      if (image.size > 2 * 1024 * 1024) {
        toast.error("Max file size is 2MB");
        return;
      }
      try {
        const base64 = await convertFileToBase64(image);
        setPartialState({
          avatarUrl: base64,
        });
      } catch (error) {
        console.error(error);
        toast.error(`Failed to convert image to base64`);
      }
    }
  };

  const handleNicknameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      nickname: e.target.value as string,
    });
  };

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      username: e.target.value as string,
    });
  };

  const handleEmailChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        email: e.target.value as string,
      };
    });
  };

  const handleSaveBtnClick = async () => {
    if (state.username === "") {
      toast.error(t("message.fill-all"));
      return;
    }

    try {
      const updateMask = [];
      if (!isEqual(currentUser.avatarUrl, state.avatarUrl)) {
        updateMask.push("avatar_url");
      }
      if (!isEqual(currentUser.nickname, state.nickname)) {
        updateMask.push("nickname");
      }
      if (!isEqual(currentUser.name.replace(UserNamePrefix, ""), state.username)) {
        updateMask.push("username");
      }
      if (!isEqual(currentUser.email, state.email)) {
        updateMask.push("email");
      }
      await userV1Store.updateUser(
        UserPb.fromPartial({
          name: `${UserNamePrefix}${state.username}`,
          id: currentUser.id,
          nickname: state.nickname,
          email: state.email,
          avatarUrl: state.avatarUrl,
        }),
        updateMask
      );
      toast.success(t("message.update-succeed"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">{t("setting.account-section.update-information")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container space-y-2">
        <div className="w-full flex flex-row justify-start items-center">
          <span className="text-sm mr-2">{t("common.avatar")}</span>
          <label className="relative cursor-pointer hover:opacity-80">
            <UserAvatar className="!w-12 !h-12" avatarUrl={state.avatarUrl} />
            <input type="file" accept="image/*" className="absolute invisible w-full h-full inset-0" onChange={handleAvatarChanged} />
          </label>
          {state.avatarUrl && (
            <Icon.X
              className="w-4 h-auto ml-1 cursor-pointer opacity-60 hover:opacity-80"
              onClick={() =>
                setPartialState({
                  avatarUrl: "",
                })
              }
            />
          )}
        </div>
        <p className="text-sm">
          {t("common.username")}
          <span className="text-sm text-gray-400 ml-1">{t("setting.account-section.username-note")}</span>
        </p>
        <input type="text" className="input-text" value={state.username} onChange={handleUsernameChanged} />
        <p className="text-sm">
          {t("common.nickname")}
          <span className="text-sm text-gray-400 ml-1">{t("setting.account-section.nickname-note")}</span>
        </p>
        <input type="text" className="input-text" value={state.nickname} onChange={handleNicknameChanged} />
        <p className="text-sm">
          {t("common.email")}
          <span className="text-sm text-gray-400 ml-1">{t("setting.account-section.email-note")}</span>
        </p>
        <input type="text" className="input-text" value={state.email} onChange={handleEmailChanged} />
        <div className="pt-2 w-full flex flex-row justify-end items-center space-x-2">
          <span className="btn-text" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn-primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </span>
        </div>
      </div>
    </>
  );
};

function showUpdateAccountDialog() {
  generateDialog(
    {
      className: "update-account-dialog",
      dialogName: "update-account-dialog",
    },
    UpdateAccountDialog
  );
}

export default showUpdateAccountDialog;
