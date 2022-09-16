import React, { useEffect, useState } from "react";
import { isEmpty } from "lodash-es";
import useI18n from "../../hooks/useI18n";
import { userService } from "../../services";
import { useAppSelector } from "../../store";
import * as api from "../../helpers/api";
import toastHelper from "../Toast";
import Dropdown from "../common/Dropdown";
import { showCommonDialog } from "../Dialog/CommonDialog";
import "../../less/settings/member-section.less";

interface State {
  createUserEmail: string;
  createUserPassword: string;
}

const PreferencesSection = () => {
  const { t } = useI18n();
  const currentUser = useAppSelector((state) => state.user.user);
  const [state, setState] = useState<State>({
    createUserEmail: "",
    createUserPassword: "",
  });
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const { data } = (await api.getUserList()).data;
    setUserList(data);
  };

  const handleEmailInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserEmail: event.target.value,
    });
  };

  const handlePasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserPassword: event.target.value,
    });
  };

  const handleCreateUserBtnClick = async () => {
    if (isEmpty(state.createUserEmail) || isEmpty(state.createUserPassword)) {
      toastHelper.error(t("message.fill-form"));
      return;
    }

    const userCreate: UserCreate = {
      email: state.createUserEmail,
      password: state.createUserPassword,
      role: "USER",
      name: state.createUserEmail,
    };

    try {
      await api.createUser(userCreate);
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
    await fetchUserList();
    setState({
      createUserEmail: "",
      createUserPassword: "",
    });
  };

  const handleArchiveUserClick = (user: User) => {
    showCommonDialog({
      title: `Archive Member`,
      content: `❗️Are you sure to archive ${user.name}?`,
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
      content: `Are you sure to delete ${user.name}? THIS ACTION IS IRREVERSIABLE.❗️`,
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
          <span className="field-text">{t("common.email")}</span>
          <input type="email" placeholder={t("common.email")} value={state.createUserEmail} onChange={handleEmailInputChange} />
        </div>
        <div className="input-form-container">
          <span className="field-text">{t("common.password")}</span>
          <input type="text" placeholder={t("common.password")} value={state.createUserPassword} onChange={handlePasswordInputChange} />
        </div>
        <div className="btns-container">
          <button onClick={handleCreateUserBtnClick}>{t("common.create")}</button>
        </div>
      </div>
      <p className="title-text">{t("setting.member-list")}</p>
      <div className="member-container field-container">
        <span className="field-text">ID</span>
        <span className="field-text">{t("common.email")}</span>
        <span></span>
      </div>
      {userList.map((user) => (
        <div key={user.id} className={`member-container ${user.rowStatus === "ARCHIVED" ? "archived" : ""}`}>
          <span className="field-text id-text">{user.id}</span>
          <span className="field-text email-text">{user.email}</span>
          <div className="buttons-container">
            {currentUser?.id === user.id ? (
              <span className="tip-text">{t("common.yourself")}</span>
            ) : (
              <Dropdown className="actions-dropdown">
                {user.rowStatus === "NORMAL" ? (
                  <button onClick={() => handleArchiveUserClick(user)}>{t("common.archive")}</button>
                ) : (
                  <>
                    <button onClick={() => handleRestoreUserClick(user)}>{t("common.restore")}</button>
                    <button className="delete" onClick={() => handleDeleteUserClick(user)}>
                      {t("common.delete")}
                    </button>
                  </>
                )}
              </Dropdown>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PreferencesSection;
