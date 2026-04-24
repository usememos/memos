import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { sortBy } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoChip from "@/components/Settings/InfoChip";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { useDeleteUser, useListUsers } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
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
  const sortedUsers = useMemo(() => sortBy(users, "id"), [users]);
  const [archiveTarget, setArchiveTarget] = useState<User | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>(undefined);

  const stringifyUserRole = (role: User_Role) => (role === User_Role.ADMIN ? t("setting.member.admin") : t("setting.member.user"));

  const handleCreateUser = () => {
    setEditingUser(undefined);
    createDialog.open();
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editDialog.open();
  };

  const handleArchiveUserClick = (user: User) => {
    setArchiveTarget(user);
  };

  const confirmArchiveUser = async () => {
    if (!archiveTarget) return;
    const username = archiveTarget.username;
    try {
      await userServiceClient.updateUser({
        user: {
          name: archiveTarget.name,
          state: State.ARCHIVED,
        },
        updateMask: create(FieldMaskSchema, { paths: ["state"] }),
      });
      toast.success(t("setting.member.archive-success", { username }));
      await refetchUsers();
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Archive user" });
    }
    setArchiveTarget(undefined);
  };

  const handleRestoreUserClick = async (user: User) => {
    const { username } = user;
    try {
      await userServiceClient.updateUser({
        user: {
          name: user.name,
          state: State.NORMAL,
        },
        updateMask: create(FieldMaskSchema, { paths: ["state"] }),
      });
      toast.success(t("setting.member.restore-success", { username }));
      await refetchUsers();
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Restore user" });
    }
  };

  const handleDeleteUserClick = (user: User) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = () => {
    if (!deleteTarget) return;
    const { username, name } = deleteTarget;
    deleteUserMutation.mutate(name, {
      onSuccess: () => {
        setDeleteTarget(undefined);
        toast.success(t("setting.member.delete-success", { username }));
      },
      onError: (error) => {
        setDeleteTarget(undefined);
        handleError(error, toast.error, { context: "Delete user" });
      },
    });
  };

  return (
    <SettingSection
      title={t("setting.member.list-title")}
      actions={
        <Button onClick={handleCreateUser}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("common.create")}
        </Button>
      }
    >
      <SettingTable
        variant="info-flow"
        columns={[
          {
            key: "member",
            header: t("setting.member.member-column"),
            render: (_, user: User) => (
              <div className="flex min-w-[18rem] items-start gap-3">
                <UserAvatar className="h-10 w-10 shrink-0 rounded-xl" avatarUrl={user.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={
                        user.displayName ? "text-sm font-medium text-foreground" : "text-sm font-medium text-muted-foreground italic"
                      }
                    >
                      {user.displayName || t("common.empty-placeholder")}
                    </span>
                    {currentUser?.name === user.name ? <span className="text-xs text-muted-foreground">{t("common.yourself")}</span> : null}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
                </div>
              </div>
            ),
          },
          {
            key: "summary",
            header: t("setting.member.summary-column"),
            render: (_, user: User) => (
              <div className="flex min-w-[18rem] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                    {stringifyUserRole(user.role)}
                  </Badge>
                  <Badge variant={user.state === State.ARCHIVED ? "outline" : "default"} className="rounded-full px-2.5 py-0.5">
                    {user.state === State.ARCHIVED ? t("setting.member.archived") : t("setting.member.active")}
                  </Badge>
                </div>
                {user.email ? (
                  <div className="flex flex-wrap gap-2">
                    <InfoChip label={t("common.email")} value={user.email} tooltip={user.email} />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-px text-right",
            render: (_, user: User) =>
              currentUser?.name === user.name ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVerticalIcon className="w-4 h-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    <DropdownMenuItem onClick={() => handleEditUser(user)}>{t("common.update")}</DropdownMenuItem>
                    {user.state === State.NORMAL ? (
                      <DropdownMenuItem onClick={() => handleArchiveUserClick(user)}>{t("setting.member.archive-member")}</DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => handleRestoreUserClick(user)}>{t("common.restore")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteUserClick(user)} className="text-destructive focus:text-destructive">
                          {t("setting.member.delete-member")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
          },
        ]}
        data={sortedUsers}
        emptyMessage={t("setting.member.no-members-found")}
        getRowKey={(user) => user.name}
      />

      {/* Create User Dialog */}
      <CreateUserDialog open={createDialog.isOpen} onOpenChange={createDialog.setOpen} onSuccess={refetchUsers} />

      {/* Edit User Dialog */}
      <CreateUserDialog open={editDialog.isOpen} onOpenChange={editDialog.setOpen} user={editingUser} onSuccess={refetchUsers} />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(undefined)}
        title={archiveTarget ? t("setting.member.archive-warning", { username: archiveTarget.username }) : ""}
        description={archiveTarget ? t("setting.member.archive-warning-description") : ""}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmArchiveUser}
        confirmVariant="default"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.member.delete-warning", { username: deleteTarget.username }) : ""}
        description={deleteTarget ? t("setting.member.delete-warning-description") : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteUser}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default MemberSection;
