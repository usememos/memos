import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { sortBy } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { useDeleteUser, useListUsers } from "@/hooks/useUserQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import { User, User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateUserDialog from "../CreateUserDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

const MemberSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { data: users = [], refetch: refetchUsers } = useListUsers();
  const deleteUserMutation = useDeleteUser();
  const createDialog = useDialog();
  const editDialog = useDialog();
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const sortedUsers = sortBy(users, "id");
  const [archiveTarget, setArchiveTarget] = useState<User | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>(undefined);

  const stringifyUserRole = (role: User_Role) => {
    if (role === User_Role.ADMIN) {
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
      updateMask: create(FieldMaskSchema, { paths: ["state"] }),
    });
    setArchiveTarget(undefined);
    toast.success(t("setting.member-section.archive-success", { username }));
    await refetchUsers();
  };

  const handleRestoreUserClick = async (user: User) => {
    const { username } = user;
    await userServiceClient.updateUser({
      user: {
        name: user.name,
        state: State.NORMAL,
      },
      updateMask: create(FieldMaskSchema, { paths: ["state"] }),
    });
    toast.success(t("setting.member-section.restore-success", { username }));
    await refetchUsers();
  };

  const handleDeleteUserClick = async (user: User) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const { username, name } = deleteTarget;
    deleteUserMutation.mutate(name);
    setDeleteTarget(undefined);
    toast.success(t("setting.member-section.delete-success", { username }));
  };

  return (
    <SettingSection
      title={t("setting.member-list")}
      actions={
        <Button onClick={handleCreateUser}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("common.create")}
        </Button>
      }
    >
      <SettingTable
        columns={[
          {
            key: "username",
            header: t("common.username"),
            render: (_, user: User) => (
              <span className="text-foreground">
                {user.username}
                {user.state === State.ARCHIVED && <span className="ml-2 italic text-muted-foreground">(Archived)</span>}
              </span>
            ),
          },
          {
            key: "role",
            header: t("common.role"),
            render: (_, user: User) => stringifyUserRole(user.role),
          },
          {
            key: "displayName",
            header: t("common.nickname"),
            render: (_, user: User) => user.displayName,
          },
          {
            key: "email",
            header: t("common.email"),
            render: (_, user: User) => user.email,
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, user: User) =>
              currentUser?.name === user.name ? (
                <span className="text-muted-foreground">{t("common.yourself")}</span>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
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
                        <DropdownMenuItem onClick={() => handleDeleteUserClick(user)} className="text-destructive focus:text-destructive">
                          {t("setting.member-section.delete-member")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
          },
        ]}
        data={sortedUsers}
        emptyMessage="No members found"
        getRowKey={(user) => user.name}
      />

      {/* Create User Dialog */}
      <CreateUserDialog open={createDialog.isOpen} onOpenChange={createDialog.setOpen} onSuccess={refetchUsers} />

      {/* Edit User Dialog */}
      <CreateUserDialog open={editDialog.isOpen} onOpenChange={editDialog.setOpen} user={editingUser} onSuccess={refetchUsers} />

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
    </SettingSection>
  );
};

export default MemberSection;
