import { timestampDate } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { handleError } from "@/lib/error";
import { CreatePersonalAccessTokenResponse, PersonalAccessToken } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";
import SettingTable from "./SettingTable";

const listAccessTokens = async (parent: string) => {
  const { personalAccessTokens } = await userServiceClient.listPersonalAccessTokens({ parent });
  return personalAccessTokens.sort(
    (a, b) =>
      ((b.createdAt ? timestampDate(b.createdAt) : undefined)?.getTime() ?? 0) -
      ((a.createdAt ? timestampDate(a.createdAt) : undefined)?.getTime() ?? 0),
  );
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [personalAccessTokens, setPersonalAccessTokens] = useState<PersonalAccessToken[]>([]);
  const createTokenDialog = useDialog();
  const [deleteTarget, setDeleteTarget] = useState<PersonalAccessToken | undefined>(undefined);

  useEffect(() => {
    if (!currentUser?.name) return;
    let canceled = false;
    listAccessTokens(currentUser.name)
      .then((tokens) => {
        if (!canceled) {
          setPersonalAccessTokens(tokens);
        }
      })
      .catch((error: unknown) => {
        if (!canceled) {
          handleError(error, toast.error, { context: "List access tokens" });
        }
      });
    return () => {
      canceled = true;
    };
  }, [currentUser?.name]);

  const handleCreateAccessTokenDialogConfirm = async (response: CreatePersonalAccessTokenResponse) => {
    const tokens = await listAccessTokens(currentUser?.name ?? "");
    setPersonalAccessTokens(tokens);
    // Copy the token to clipboard - this is the only time it will be shown
    if (response.token) {
      copy(response.token);
      toast.success(t("setting.access-token-section.access-token-copied-to-clipboard"));
    }
    toast.success(
      t("setting.access-token-section.create-dialog.access-token-created", {
        description: response.personalAccessToken?.description ?? "",
      }),
    );
  };

  const handleCreateToken = () => {
    createTokenDialog.open();
  };

  const handleDeleteAccessToken = async (token: PersonalAccessToken) => {
    setDeleteTarget(token);
  };

  const confirmDeleteAccessToken = async () => {
    if (!deleteTarget) return;
    const { name: tokenName, description } = deleteTarget;
    await userServiceClient.deletePersonalAccessToken({ name: tokenName });
    setPersonalAccessTokens((prev) => prev.filter((token) => token.name !== tokenName));
    setDeleteTarget(undefined);
    toast.success(t("setting.access-token-section.access-token-deleted", { description }));
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
            key: "description",
            header: t("common.description"),
            render: (_, token: PersonalAccessToken) => <span className="text-foreground">{token.description}</span>,
          },
          {
            key: "createdAt",
            header: t("setting.access-token-section.create-dialog.created-at"),
            render: (_, token: PersonalAccessToken) => (token.createdAt ? timestampDate(token.createdAt) : undefined)?.toLocaleString(),
          },
          {
            key: "expiresAt",
            header: t("setting.access-token-section.create-dialog.expires-at"),
            render: (_, token: PersonalAccessToken) =>
              (token.expiresAt ? timestampDate(token.expiresAt) : undefined)?.toLocaleString() ??
              t("setting.access-token-section.create-dialog.duration-never"),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, token: PersonalAccessToken) => (
              <Button variant="ghost" size="sm" onClick={() => handleDeleteAccessToken(token)}>
                <TrashIcon className="text-destructive w-4 h-auto" />
              </Button>
            ),
          },
        ]}
        data={personalAccessTokens}
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
