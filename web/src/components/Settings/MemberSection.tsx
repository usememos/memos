import { sortBy } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import CreateUserDialog from "../CreateUserDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const MemberSection = observer(() => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const createDialog = useDialog();
  const editDialog = useDialog();
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const sortedUsers = sortBy(users, "id");
  const [archiveTarget, setArchiveTarget] = useState<User | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>(undefined);

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

  const handleCreateUser = () => {
    setEditingUser(undefined);
    createDialog.open();
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editDialog.open();
  };

  const handleArchiveUserClick = async (user: User) => {
    setArchiveTarget(user);
  };

  const confirmArchiveUser = async () => {
    if (!archiveTarget) return;
    const username = archiveTarget.username;
    await userServiceClient.updateUser({
      user: {
        name: archiveTarget.name,
        state: State.ARCHIVED,
      },
      updateMask: ["state"],
    });
    setArchiveTarget(undefined);
    toast.success(t("setting.member-section.archive-success", { username }));
    await fetchUsers();
  };

  const handleRestoreUserClick = async (user: User) => {
    const { username } = user;
    await userServiceClient.updateUser({
      user: {
        name: user.name,
        state: State.NORMAL,
      },
      updateMask: ["state"],
    });
    toast.success(t("setting.member-section.restore-success", { username }));
    await fetchUsers();
  };

  const handleDeleteUserClick = async (user: User) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const { username, name } = deleteTarget;
    await userStore.deleteUser(name);
    setDeleteTarget(undefined);
    toast.success(t("setting.member-section.delete-success", { username }));
    await fetchUsers();
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="w-full flex flex-row justify-between items-center">
        <p className="font-medium text-muted-foreground">{t("setting.member-section.create-a-member")}</p>
        <Button onClick={handleCreateUser}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("common.create")}
        </Button>
      </div>
      <div className="w-full flex flex-row justify-between items-center mt-6">
        <div className="title-text">{t("setting.member-list")}</div>
      </div>
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full align-middle border border-border rounded-lg">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="text-sm font-semibold text-left text-foreground">
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
            <tbody className="divide-y divide-border">
              {sortedUsers.map((user) => (
                <tr key={user.name}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                    {user.username}
                    <span className="ml-1 italic">{user.state === State.ARCHIVED && "(Archived)"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">{stringifyUserRole(user.role)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">{user.displayName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">{user.email}</td>
                  <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium flex justify-end">
                    {currentUser?.name === user.name ? (
                      <span>{t("common.yourself")}</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">
                            <MoreVerticalIcon className="w-4 h-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={2}>
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>{t("common.update")}</DropdownMenuItem>
                          {user.state === State.NORMAL ? (
                            <DropdownMenuItem onClick={() => handleArchiveUserClick(user)}>
                              {t("setting.member-section.archive-member")}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => handleRestoreUserClick(user)}>{t("common.restore")}</DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteUserClick(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                {t("setting.member-section.delete-member")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog open={createDialog.isOpen} onOpenChange={createDialog.setOpen} onSuccess={fetchUsers} />

      {/* Edit User Dialog */}
      <CreateUserDialog open={editDialog.isOpen} onOpenChange={editDialog.setOpen} user={editingUser} onSuccess={fetchUsers} />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(undefined)}
        title={archiveTarget ? t("setting.member-section.archive-warning", { username: archiveTarget.username }) : ""}
        description={archiveTarget ? t("setting.member-section.archive-warning-description") : ""}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmArchiveUser}
        confirmVariant="default"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.member-section.delete-warning", { username: deleteTarget.username }) : ""}
        description={deleteTarget ? t("setting.member-section.delete-warning-description") : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteUser}
        confirmVariant="destructive"
      />
    </div>
  );
});

export default MemberSection;
