import { Radio, RadioGroup } from "@mui/joy";
import { Button, Input } from "@usememos/mui";
import { sortBy } from "lodash-es";
import { MoreVerticalIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { userStore } from "@/store/v2";
import { State } from "@/types/proto/api/v1/common";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import showCreateUserDialog from "../CreateUserDialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";

interface LocalState {
  creatingUser: User;
}

const MemberSection = observer(() => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<LocalState>({
    creatingUser: User.fromPartial({
      username: "",
      password: "",
      role: User_Role.USER,
    }),
  });
  const [users, setUsers] = useState<User[]>([]);
  const sortedUsers = sortBy(users, "id");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const users = await userStore.fetchUsers();
    setUsers(users);
  };

  const stringifyUserRole = (role: User_Role) => {
    if (role === User_Role.HOST) {
      return "Host";
    } else if (role === User_Role.ADMIN) {
      return t("setting.member-section.admin");
    } else {
      return t("setting.member-section.user");
    }
  };

  const handleUsernameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      creatingUser: {
        ...state.creatingUser,
        username: event.target.value,
      },
    });
  };

  const handlePasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      creatingUser: {
        ...state.creatingUser,
        password: event.target.value,
      },
    });
  };

  const handleUserRoleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      creatingUser: {
        ...state.creatingUser,
        role: event.target.value as User_Role,
      },
    });
  };

  const handleCreateUserBtnClick = async () => {
    if (state.creatingUser.username === "" || state.creatingUser.password === "") {
      toast.error(t("message.fill-all"));
      return;
    }

    try {
      await userServiceClient.createUser({
        user: {
          username: state.creatingUser.username,
          password: state.creatingUser.password,
          role: state.creatingUser.role,
        },
      });
    } catch (error: any) {
      toast.error(error.details);
    }
    await fetchUsers();
    setState({
      ...state,
      creatingUser: User.fromPartial({
        username: "",
        password: "",
        role: User_Role.USER,
      }),
    });
  };

  const handleArchiveUserClick = async (user: User) => {
    const confirmed = window.confirm(t("setting.member-section.archive-warning", { username: user.nickname }));
    if (confirmed) {
      await userServiceClient.updateUser({
        user: {
          name: user.name,
          state: State.ARCHIVED,
        },
        updateMask: ["state"],
      });
      fetchUsers();
    }
  };

  const handleRestoreUserClick = async (user: User) => {
    await userServiceClient.updateUser({
      user: {
        name: user.name,
        state: State.NORMAL,
      },
      updateMask: ["state"],
    });
    fetchUsers();
  };

  const handleDeleteUserClick = async (user: User) => {
    const confirmed = window.confirm(t("setting.member-section.delete-warning", { username: user.nickname }));
    if (confirmed) {
      await userStore.deleteUser(user.name);
      fetchUsers();
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.member-section.create-a-member")}</p>
      <div className="w-auto flex flex-col justify-start items-start gap-2 border border-zinc-200 rounded-md py-2 px-3 dark:border-zinc-700">
        <div className="flex flex-col justify-start items-start gap-1">
          <span>{t("common.username")}</span>
          <Input
            type="text"
            placeholder={t("common.username")}
            autoComplete="off"
            value={state.creatingUser.username}
            onChange={handleUsernameInputChange}
          />
        </div>
        <div className="flex flex-col justify-start items-start gap-1">
          <span>{t("common.password")}</span>
          <Input
            type="password"
            placeholder={t("common.password")}
            autoComplete="off"
            value={state.creatingUser.password}
            onChange={handlePasswordInputChange}
          />
        </div>
        <div className="flex flex-col justify-start items-start gap-1">
          <span>{t("common.role")}</span>
          <RadioGroup orientation="horizontal" defaultValue={User_Role.USER} onChange={handleUserRoleInputChange}>
            <Radio value={User_Role.USER} label={t("setting.member-section.user")} />
            <Radio value={User_Role.ADMIN} label={t("setting.member-section.admin")} />
          </RadioGroup>
        </div>
        <div className="mt-2">
          <Button color="primary" onClick={handleCreateUserBtnClick}>
            {t("common.create")}
          </Button>
        </div>
      </div>
      <div className="w-full flex flex-row justify-between items-center mt-6">
        <div className="title-text">{t("setting.member-list")}</div>
      </div>
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full align-middle border border-zinc-200 rounded-lg dark:border-zinc-600">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-600">
            <thead>
              <tr className="text-sm font-semibold text-left text-gray-900 dark:text-gray-400">
                <th scope="col" className="px-3 py-2">
                  {t("common.username")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("common.role")}
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
              {sortedUsers.map((user) => (
                <tr key={user.name}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {user.username}
                    <span className="ml-1 italic">{user.state === State.ARCHIVED && "(Archived)"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{stringifyUserRole(user.role)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{user.nickname}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium flex justify-end">
                    {currentUser?.name === user.name ? (
                      <span>{t("common.yourself")}</span>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center justify-center p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded">
                            <MoreVerticalIcon className="w-4 h-auto" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" sideOffset={2}>
                          <div className="flex flex-col gap-0.5 text-sm">
                            <button
                              onClick={() => showCreateUserDialog(user, () => fetchUsers())}
                              className="flex items-center gap-2 px-2 py-1 text-left dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                            >
                              {t("common.update")}
                            </button>
                            {user.state === State.NORMAL ? (
                              <button
                                onClick={() => handleArchiveUserClick(user)}
                                className="flex items-center gap-2 px-2 py-1 text-left dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                              >
                                {t("setting.member-section.archive-member")}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRestoreUserClick(user)}
                                  className="flex items-center gap-2 px-2 py-1 text-left dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                                >
                                  {t("common.restore")}
                                </button>
                                <button
                                  onClick={() => handleDeleteUserClick(user)}
                                  className="flex items-center gap-2 px-2 py-1 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                                >
                                  {t("setting.member-section.delete-member")}
                                </button>
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
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
});

export default MemberSection;
