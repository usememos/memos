import { ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserWebhook } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateWebhookDialog from "../CreateWebhookDialog";
import SettingTable from "./SettingTable";

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [isCreateWebhookDialogOpen, setIsCreateWebhookDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWebhook | undefined>(undefined);

  const listWebhooks = async () => {
    if (!currentUser) return [];
    const { webhooks } = await userServiceClient.listUserWebhooks({
      parent: currentUser.name,
    });
    return webhooks;
  };

  useEffect(() => {
    listWebhooks().then((webhooks) => {
      setWebhooks(webhooks);
    });
  }, [currentUser]);

  const handleCreateWebhookDialogConfirm = async () => {
    const webhooks = await listWebhooks();
    const name = webhooks[webhooks.length - 1]?.displayName || "";
    setWebhooks(webhooks);
    setIsCreateWebhookDialogOpen(false);
    toast.success(t("setting.webhook-section.create-dialog.create-webhook-success", { name }));
  };

  const handleDeleteWebhook = async (webhook: UserWebhook) => {
    setDeleteTarget(webhook);
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteTarget) return;
    await userServiceClient.deleteUserWebhook({ name: deleteTarget.name });
    setWebhooks(webhooks.filter((item) => item.name !== deleteTarget.name));
    setDeleteTarget(undefined);
    toast.success(t("setting.webhook-section.delete-dialog.delete-webhook-success", { name: deleteTarget.displayName }));
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{t("setting.webhook-section.title")}</h4>
        <Button onClick={() => setIsCreateWebhookDialogOpen(true)} size="sm">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {t("common.create")}
        </Button>
      </div>

      <SettingTable
        columns={[
          {
            key: "displayName",
            header: t("common.name"),
            render: (_, webhook: UserWebhook) => <span className="text-foreground">{webhook.displayName}</span>,
          },
          {
            key: "url",
            header: t("setting.webhook-section.url"),
            render: (_, webhook: UserWebhook) => (
              <span className="max-w-[300px] inline-block truncate text-foreground" title={webhook.url}>
                {webhook.url}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, webhook: UserWebhook) => (
              <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook)}>
                <TrashIcon className="text-destructive w-4 h-auto" />
              </Button>
            ),
          },
        ]}
        data={webhooks}
        emptyMessage={t("setting.webhook-section.no-webhooks-found")}
        getRowKey={(webhook) => webhook.name}
      />

      <div className="w-full">
        <Link
          className="text-muted-foreground text-sm inline-flex items-center hover:underline hover:text-primary"
          to="https://usememos.com/docs/integrations/webhooks"
          target="_blank"
        >
          {t("common.learn-more")}
          <ExternalLinkIcon className="w-4 h-4 ml-1" />
        </Link>
      </div>

      <CreateWebhookDialog
        open={isCreateWebhookDialogOpen}
        onOpenChange={setIsCreateWebhookDialogOpen}
        onSuccess={handleCreateWebhookDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.webhook-section.delete-dialog.delete-webhook-title", { name: deleteTarget?.displayName || "" })}
        description={t("setting.webhook-section.delete-dialog.delete-webhook-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteWebhook}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default WebhookSection;
