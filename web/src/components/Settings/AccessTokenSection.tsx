import copy from "copy-to-clipboard";
import { ClipboardIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { UserAccessToken } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";
import SettingTable from "./SettingTable";

const listAccessTokens = async (parent: string) => {
  const { accessTokens } = await userServiceClient.listUserAccessTokens({ parent });
  return accessTokens.sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userAccessTokens, setUserAccessTokens] = useState<UserAccessToken[]>([]);
  const createTokenDialog = useDialog();
  const [deleteTarget, setDeleteTarget] = useState<UserAccessToken | undefined>(undefined);

  useEffect(() => {
    listAccessTokens(currentUser.name).then((accessTokens) => {
      setUserAccessTokens(accessTokens);
    });
  }, []);

  const handleCreateAccessTokenDialogConfirm = async (created: UserAccessToken) => {
    const accessTokens = await listAccessTokens(currentUser.name);
    setUserAccessTokens(accessTokens);
    toast.success(t("setting.access-token-section.create-dialog.access-token-created", { description: created.description }));
  };

  const handleCreateToken = () => {
    createTokenDialog.open();
  };

  const copyAccessToken = (accessToken: string) => {
    copy(accessToken);
    toast.success(t("setting.access-token-section.access-token-copied-to-clipboard"));
  };

  const handleDeleteAccessToken = async (userAccessToken: UserAccessToken) => {
    setDeleteTarget(userAccessToken);
  };

  const confirmDeleteAccessToken = async () => {
    if (!deleteTarget) return;
    const { name: tokenName, description } = deleteTarget;
    await userServiceClient.deleteUserAccessToken({ name: tokenName });
    // Filter by stable resource name to avoid ambiguity with duplicate token strings
    setUserAccessTokens((prev) => prev.filter((token) => token.name !== tokenName));
    setDeleteTarget(undefined);
    toast.success(t("setting.access-token-section.access-token-deleted", { description }));
  };

  const getFormatedAccessToken = (accessToken: string) => {
    return `${accessToken.slice(0, 4)}****${accessToken.slice(-4)}`;
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium text-muted-foreground">{t("setting.access-token-section.title")}</h4>
          <p className="text-xs text-muted-foreground">{t("setting.access-token-section.description")}</p>
        </div>
        <Button onClick={handleCreateToken} size="sm">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {t("common.create")}
        </Button>
      </div>

      <SettingTable
        columns={[
          {
            key: "accessToken",
            header: t("setting.access-token-section.token"),
            render: (_, token: UserAccessToken) => (
              <div className="flex items-center gap-1">
                <span className="font-mono text-foreground">{getFormatedAccessToken(token.accessToken)}</span>
                <Button variant="ghost" size="sm" onClick={() => copyAccessToken(token.accessToken)}>
                  <ClipboardIcon className="w-4 h-auto text-muted-foreground" />
                </Button>
              </div>
            ),
          },
          {
            key: "description",
            header: t("common.description"),
            render: (_, token: UserAccessToken) => <span className="text-foreground">{token.description}</span>,
          },
          {
            key: "issuedAt",
            header: t("setting.access-token-section.create-dialog.created-at"),
            render: (_, token: UserAccessToken) => token.issuedAt?.toLocaleString(),
          },
          {
            key: "expiresAt",
            header: t("setting.access-token-section.create-dialog.expires-at"),
            render: (_, token: UserAccessToken) =>
              token.expiresAt?.toLocaleString() ?? t("setting.access-token-section.create-dialog.duration-never"),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, token: UserAccessToken) => (
              <Button variant="ghost" size="sm" onClick={() => handleDeleteAccessToken(token)}>
                <TrashIcon className="text-destructive w-4 h-auto" />
              </Button>
            ),
          },
        ]}
        data={userAccessTokens}
        emptyMessage="No access tokens found"
        getRowKey={(token) => token.name}
      />

      {/* Create Access Token Dialog */}
      <CreateAccessTokenDialog
        open={createTokenDialog.isOpen}
        onOpenChange={createTokenDialog.setOpen}
        onSuccess={handleCreateAccessTokenDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.access-token-section.access-token-deletion", { description: deleteTarget.description }) : ""}
        description={t("setting.access-token-section.access-token-deletion-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteAccessToken}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default AccessTokenSection;
