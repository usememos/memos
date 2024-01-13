import { Button, Dropdown, Input, Menu, MenuButton } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserNamePrefix, useUserStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v2/common";
import { User, User_Role } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import showChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";

interface State {
  createUserUsername: string;
  createUserPassword: string;
}

const MemberSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const userStore = useUserStore();
  const [state, setState] = useState<State>({
    createUserUsername: "",
    createUserPassword: "",
  });
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const users = await userStore.fetchUsers();
    setUserList(users);
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

    try {
      await userServiceClient.createUser({
        user: {
          name: `${UserNamePrefix}${state.createUserUsername}`,
          password: state.createUserPassword,
          role: User_Role.USER,
        },
      });
    } catch (error: any) {
      toast.error(error.details);
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
      content: t("setting.member-section.archive-warning", { username: user.nickname }),
      style: "danger",
      dialogName: "archive-user-dialog",
      onConfirm: async () => {
        await userServiceClient.updateUser({
          user: {
            name: user.name,
            rowStatus: RowStatus.ARCHIVED,
          },
          updateMask: ["row_status"],
        });
        fetchUserList();
      },
    });
  };

  const handleRestoreUserClick = async (user: User) => {
    await userServiceClient.updateUser({
      user: {
        name: user.name,
        rowStatus: RowStatus.ACTIVE,
      },
      updateMask: ["row_status"],
    });
    fetchUserList();
  };

  const handleDeleteUserClick = (user: User) => {
    showCommonDialog({
      title: t("setting.member-section.delete-member"),
      content: t("setting.member-section.delete-warning", { username: user.nickname }),
      style: "danger",
      dialogName: "delete-user-dialog",
      onConfirm: async () => {
        await userStore.deleteUser(user.name);
        fetchUserList();
      },
    });
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.member-section.create-a-member")}</p>
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
        <div className="inline-block min-w-full align-middle border rounded-lg dark:border-zinc-600">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-600">
            <thead>
              <tr className="text-sm font-semibold text-left text-gray-900 dark:text-gray-400">
                <th scope="col" className="py-2 pl-4 pr-3">
                  ID
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("common.username")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("common.nickname")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("common.email")}
                </th>
                <th scope="col" className="relative py-2 pl-3 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-600">
              {userList.map((user) => (
                <tr key={user.id}>
                  <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-400">{user.id}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {user.username}
                    <span className="ml-1 italic">{user.rowStatus === RowStatus.ARCHIVED && "(Archived)"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{user.nickname}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium flex justify-end">
                    {currentUser?.id === user.id ? (
                      <span>{t("common.yourself")}</span>
                    ) : (
                      <Dropdown>
                        <MenuButton size="sm">
                          <Icon.MoreVertical className="w-4 h-auto" />
                        </MenuButton>
                        <Menu>
                          <button
                            className="w-full text-left text-sm whitespace-nowrap leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                            onClick={() => handleChangePasswordClick(user)}
                          >
                            {t("setting.account-section.change-password")}
                          </button>
                          {user.rowStatus === RowStatus.ACTIVE ? (
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

export default MemberSection;
