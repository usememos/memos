import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { Badge, Button, Menu, Tooltip } from "@usememos/ui";
import { sortBy } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoChip from "@/components/Settings/InfoChip";
import UserAvatar from "@/components/UserAvatar";
import { userServiceClient } from "@/connect";
import { findManagedResource, useConfigurationStatus } from "@/hooks/useConfigurationQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { useDeleteUser, useListUsers } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { State } from "@/types/proto/api/common_pb";
import { User, User_Role } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateUserDialog from "../CreateUserDialog";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import { useExportMemos } from "./useExportMemos";

const MemberSection = () => {
  const t = useTranslate();
  const configurationStatus = useConfigurationStatus();
  const currentUser = useCurrentUser();
  const { data: users = [], refetch: refetchUsers } = useListUsers();
  const deleteUserMutation = useDeleteUser();
  const { exportMemos, exporting } = useExportMemos();
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
      toast.add({ title: t("setting.member.archive-success", { username }), type: "success" });
      await refetchUsers();
    } catch (error: unknown) {
      handleError(error, showErrorToast, { context: "Archive user" });
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
      toast.add({ title: t("setting.member.restore-success", { username }), type: "success" });
      await refetchUsers();
    } catch (error: unknown) {
      handleError(error, showErrorToast, { context: "Restore user" });
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
        toast.add({ title: t("setting.member.delete-success", { username }), type: "success" });
      },
      onError: (error) => {
        setDeleteTarget(undefined);
        handleError(error, showErrorToast, { context: "Delete user" });
      },
    });
  };

  return (
    <SettingSection
      title={t("setting.member.list-title")}
      actions={
        <Button variant="primary" onClick={handleCreateUser} icon={<PlusIcon />}>
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
                <UserAvatar className="h-10 w-10 shrink-0" avatarUrl={user.avatarUrl} name={user.displayName || user.username} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={user.displayName ? "mu-label text-mu-text" : "mu-label text-mu-text-secondary italic"}>
                      {user.displayName || t("common.empty-placeholder")}
                    </span>
                    {currentUser?.name === user.name ? (
                      <span className="mu-caption text-mu-text-secondary">{t("common.yourself")}</span>
                    ) : null}
                  </div>
                  <span className="truncate mu-caption text-mu-text-secondary">@{user.username}</span>
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
                  <Badge>{stringifyUserRole(user.role)}</Badge>
                  <Badge tone={user.state === State.ARCHIVED ? "outline" : "neutral"}>
                    {user.state === State.ARCHIVED ? t("setting.member.archived") : t("setting.member.active")}
                  </Badge>
                </div>
                {user.email || findManagedResource(configurationStatus, user.name) ? (
                  <div className="flex flex-wrap gap-2">
                    {user.email ? <InfoChip label={t("common.email")} value={user.email} tooltip={user.email} /> : null}
                    <ManagedByConfigurationChip resource={findManagedResource(configurationStatus, user.name)} />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-px",
            alignEnd: true,
            render: (_, user: User) =>
              currentUser?.name === user.name ? null : (
                <Menu.Root modal={false}>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Menu.Trigger
                          render={
                            <Button variant="ghost" aria-label={`${t("common.more")}: ${user.username}`} icon={<MoreVerticalIcon />} />
                          }
                        />
                      }
                    />
                    <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                  </Tooltip.Root>
                  <Menu.Popup align="end">
                    <Menu.Item onClick={() => handleEditUser(user)}>{t("common.update")}</Menu.Item>
                    <Menu.Item disabled={exporting} onClick={() => exportMemos(user.username)}>
                      {t("setting.member.export-memos")}
                    </Menu.Item>
                    {user.state === State.NORMAL ? (
                      <Menu.Item onClick={() => handleArchiveUserClick(user)}>{t("setting.member.archive-member")}</Menu.Item>
                    ) : (
                      <>
                        <Menu.Item onClick={() => handleRestoreUserClick(user)}>{t("common.restore")}</Menu.Item>
                        {findManagedResource(configurationStatus, user.name) ? null : (
                          <Menu.Item onClick={() => handleDeleteUserClick(user)} danger>
                            {t("setting.member.delete-member")}
                          </Menu.Item>
                        )}
                      </>
                    )}
                  </Menu.Popup>
                </Menu.Root>
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
        confirmVariant="primary"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.member.delete-warning", { username: deleteTarget.username }) : ""}
        description={deleteTarget ? t("setting.member.delete-warning-description") : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteUser}
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default MemberSection;
