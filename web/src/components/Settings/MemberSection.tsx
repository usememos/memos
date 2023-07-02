import { Table } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/store/module";
import * as api from "@/helpers/api";
import Dropdown from "../kit/Dropdown";
import { showCommonDialog } from "../Dialog/CommonDialog";
import showChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import "@/less/settings/member-section.less";

interface State {
  createUserUsername: string;
  createUserPassword: string;
}

const PreferencesSection = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const currentUser = userStore.state.user;
  const [state, setState] = useState<State>({
    createUserUsername: "",
    createUserPassword: "",
  });
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const { data } = await api.getUserList();
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

  const handleCreateUserBtnClick = async () => {
    if (state.createUserUsername === "" || state.createUserPassword === "") {
      toast.error(t("message.fill-form"));
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
      toast.error(error.response.data.message);
    }
    await fetchUserList();
    setState({
      createUserUsername: "",
      createUserPassword: "",
    });
  };

  const handleChangePasswordClick = (user: User) => {
    showChangeMemberPasswordDialog(user);
  };

  const handleArchiveUserClick = (user: User) => {
    showCommonDialog({
      title: t("setting.member-section.archive-member"),
      content: t("setting.member-section.archive-warning", { username: user.username }),
      style: "warning",
      dialogName: "archive-user-dialog",
      onConfirm: async () => {
        await userStore.patchUser({
          id: user.id,
          rowStatus: "ARCHIVED",
        });
        fetchUserList();
      },
    });
  };

  const handleRestoreUserClick = async (user: User) => {
    await userStore.patchUser({
      id: user.id,
      rowStatus: "NORMAL",
    });
    fetchUserList();
  };

  const handleDeleteUserClick = (user: User) => {
    showCommonDialog({
      title: t("setting.member-section.delete-member"),
      content: t("setting.member-section.delete-warning", { username: user.username }),
      style: "warning",
      dialogName: "delete-user-dialog",
      onConfirm: async () => {
        await userStore.deleteUser({
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
          <input
            type="text"
            autoComplete="new-password"
            placeholder={t("common.username")}
            value={state.createUserUsername}
            onChange={handleUsernameInputChange}
          />
        </div>
        <div className="input-form-container">
          <span className="field-text">{t("common.password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t("common.password")}
            value={state.createUserPassword}
            onChange={handlePasswordInputChange}
          />
        </div>
        <div className="btns-container">
          <button className="btn-normal" onClick={handleCreateUserBtnClick}>
            {t("common.create")}
          </button>
        </div>
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <div className="title-text">{t("setting.member-list")}</div>
      </div>
      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>{t("common.username")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {userList.map((user) => (
            <tr key={user.id}>
              <td className="field-text id-text">{user.id}</td>
              <td className="field-text username-text">{user.username}</td>
              <td className="flex flex-row justify-end items-center">
                {currentUser?.id === user.id ? (
                  <span className="tip-text">{t("common.yourself")}</span>
                ) : (
                  <Dropdown
                    actions={
                      <>
                        <button
                          className="w-full text-left text-sm whitespace-nowrap leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                          onClick={() => handleChangePasswordClick(user)}
                        >
                          {t("setting.account-section.change-password")}
                        </button>
                        {user.rowStatus === "NORMAL" ? (
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                            onClick={() => handleArchiveUserClick(user)}
                          >
                            {t("common.archive")}
                          </button>
                        ) : (
                          <>
                            <button
                              className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                              onClick={() => handleRestoreUserClick(user)}
                            >
                              {t("common.restore")}
                            </button>
                            <button
                              className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-600"
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
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default PreferencesSection;
