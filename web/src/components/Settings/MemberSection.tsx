import { Button, Dropdown, Input, Menu, MenuButton } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "@/helpers/api";
import { useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import showChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";

interface State {
  createUserUsername: string;
  createUserPassword: string;
}

const PreferencesSection = () => {
  const t = useTranslate();
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
    setUserList(data.sort((a, b) => a.id - b.id));
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
      <div className="w-full flex flex-col justify-start items-start gap-2">
        <div className="flex flex-col justify-start items-start gap-1">
          <span className="text-sm">{t("common.username")}</span>
          <Input type="text" placeholder={t("common.username")} value={state.createUserUsername} onChange={handleUsernameInputChange} />
        </div>
        <div className="flex flex-col justify-start items-start gap-1">
          <span className="text-sm">{t("common.password")}</span>
          <Input type="password" placeholder={t("common.password")} value={state.createUserPassword} onChange={handlePasswordInputChange} />
        </div>
        <div className="btns-container">
          <Button onClick={handleCreateUserBtnClick}>{t("common.create")}</Button>
        </div>
      </div>
      <div className="w-full flex flex-row justify-between items-center mt-6">
        <div className="title-text">{t("setting.member-list")}</div>
      </div>
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-300">
            <thead>
              <tr>
                <th scope="col" className="py-2 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  ID
                </th>
                <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  {t("common.username")}
                </th>
                <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  {t("common.nickname")}
                </th>
                <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  {t("common.email")}
                </th>
                <th scope="col" className="relative py-2 pl-3 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {userList.map((user) => (
                <tr key={user.id}>
                  <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-900">{user.id}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {user.username}
                    <span className="ml-1 italic">{user.rowStatus === "ARCHIVED" && "(Archived)"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{user.nickname}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">{user.email}</td>
                  <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium flex justify-end">
                    {currentUser?.id === user.id ? (
                      <span>{t("common.yourself")}</span>
                    ) : (
                      <Dropdown>
                        <MenuButton size="sm">
                          <Icon.MoreVertical className="w-4 h-auto" />
                        </MenuButton>
                        <Menu>
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
                                {t("setting.member-section.archive-member")}
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
                                  {t("setting.member-section.delete-member")}
                                </button>
                              </>
                            )}
                          </>
                        </Menu>
                      </Dropdown>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PreferencesSection;
