import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { userService } from "../../services";
import { useAppSelector } from "../../store";
import * as api from "../../helpers/api";
import toastHelper from "../Toast";
import Dropdown from "../common/Dropdown";
import { showCommonDialog } from "../Dialog/CommonDialog";
import "../../less/settings/member-section.less";

interface State {
  createUserUsername: string;
  createUserPassword: string;
  repeatUserPassword: string;
}

const PreferencesSection = () => {
  const { t } = useTranslation();
  const currentUser = useAppSelector((state) => state.user.user);
  const [state, setState] = useState<State>({
    createUserUsername: "",
    createUserPassword: "",
    repeatUserPassword: "",
  });
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const { data } = (await api.getUserList()).data;
    setUserList(data);
  };

  const handleUsernameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserUsername: event.target.value,
    });
  };

  const handlePasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserPassword: event.target.value,
    });
  };

  const handleRepeatPasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      repeatUserPassword: event.target.value,
    });
  };

  const handleCreateUserBtnClick = async () => {
    if (state.createUserUsername === "" || state.createUserPassword === "") {
      toastHelper.error(t("message.fill-form"));
      return;
    }
    if (state.createUserPassword !== state.repeatUserPassword) {
      toastHelper.error(t("message.password-not-match"));
      return;
    }

    const userCreate: UserCreate = {
      username: state.createUserUsername,
      password: state.createUserPassword,
      role: "USER",
    };

    try {
      await api.createUser(userCreate);
    } catch (error: any) {
      toastHelper.error(error.response.data.message);
    }
    await fetchUserList();
    setState({
      createUserUsername: "",
      createUserPassword: "",
      repeatUserPassword: "",
    });
  };

  const handleArchiveUserClick = (user: User) => {
    showCommonDialog({
      title: `Archive Member`,
      content: `❗️Are you sure to archive ${user.username}?`,
      style: "warning",
      onConfirm: async () => {
        await userService.patchUser({
          id: user.id,
          rowStatus: "ARCHIVED",
        });
        fetchUserList();
      },
    });
  };

  const handleRestoreUserClick = async (user: User) => {
    await userService.patchUser({
      id: user.id,
      rowStatus: "NORMAL",
    });
    fetchUserList();
  };

  const handleDeleteUserClick = (user: User) => {
    showCommonDialog({
      title: `Delete Member`,
      content: `Are you sure to delete ${user.username}? THIS ACTION IS IRREVERSIABLE.❗️`,
      style: "warning",
      onConfirm: async () => {
        await userService.deleteUser({
          id: user.id,
        });
        fetchUserList();
      },
    });
  };

  return (
    <div className="section-container member-section-container">
      <p className="title-text">{t("setting.member-section.create-a-member")}</p>
      <div className="create-member-container">
        <div className="input-form-container">
          <span className="field-text">{t("common.username")}</span>
          <input type="text" placeholder={t("common.username")} value={state.createUserUsername} onChange={handleUsernameInputChange} />
        </div>
        <div className="input-form-container">
          <span className="field-text">{t("common.password")}</span>
          <input type="password" placeholder={t("common.password")} value={state.createUserPassword} onChange={handlePasswordInputChange} />
        </div>
        <div className="input-form-container">
          <span className="field-text">{t("common.repeat-password-short")}</span>
          <input
            type="password"
            placeholder={t("common.repeat-password")}
            value={state.repeatUserPassword}
            onChange={handleRepeatPasswordInputChange}
          />
        </div>
        <div className="btns-container">
          <button onClick={handleCreateUserBtnClick}>{t("common.create")}</button>
        </div>
      </div>
      <p className="title-text">{t("setting.member-list")}</p>
      <div className="member-container field-container">
        <span className="field-text">ID</span>
        <span className="field-text username-field">{t("common.username")}</span>
        <span></span>
      </div>
      {userList.map((user) => (
        <div key={user.id} className={`member-container ${user.rowStatus === "ARCHIVED" ? "archived" : ""}`}>
          <span className="field-text id-text">{user.id}</span>
          <span className="field-text username-text">{user.username}</span>
          <div className="buttons-container">
            {currentUser?.id === user.id ? (
              <span className="tip-text">{t("common.yourself")}</span>
            ) : (
              <Dropdown
                actionsClassName="!w-24"
                actions={
                  <>
                    {user.rowStatus === "NORMAL" ? (
                      <button
                        className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                        onClick={() => handleArchiveUserClick(user)}
                      >
                        {t("common.archive")}
                      </button>
                    ) : (
                      <>
                        <button
                          className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                          onClick={() => handleRestoreUserClick(user)}
                        >
                          {t("common.restore")}
                        </button>
                        <button
                          className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100"
                          onClick={() => handleDeleteUserClick(user)}
                        >
                          {t("common.delete")}
                        </button>
                      </>
                    )}
                  </>
                }
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PreferencesSection;
